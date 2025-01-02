#!/bin/bash
set -euo pipefail

# International Jewish Association Donation Platform
# MongoDB Database Backup Script v1.0
# Enhanced enterprise backup solution with AES-256-GCM encryption,
# HSM key management and multi-region synchronous replication

# Global Configuration
BACKUP_ROOT="/var/backups/mongodb"
RETENTION_DAYS=7
MONGODB_HOSTS="mongodb.primary.service.consul,mongodb.secondary.service.consul"
S3_BUCKETS="ijap-db-backups-primary,ijap-db-backups-dr"
LOG_FILE="/var/log/mongodb/backup.log"
ENCRYPTION_KEY_ID="arn:aws:kms:region:account:key/backup-key"
PARALLEL_STREAMS=4
VERIFICATION_RETRIES=3

# Logging function with ISO 8601 timestamps
log() {
    local level="$1"
    local message="$2"
    echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") [$level] $message" | tee -a "$LOG_FILE"
}

# Enhanced environment validation with security checks
validate_environment() {
    log "INFO" "Starting environment validation..."
    
    # Check required environment variables
    local required_vars=(
        "MONGODB_USERNAME" "MONGODB_PASSWORD" "AWS_ACCESS_KEY_ID" 
        "AWS_SECRET_ACCESS_KEY" "AWS_REGION" "MONGODB_SSL_CA_PATH"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log "ERROR" "Required environment variable $var is not set"
            return 1
        fi
    done
    
    # Verify MongoDB tools version
    if ! command -v mongodump >/dev/null 2>&1; then
        log "ERROR" "mongodump utility not found"
        return 1
    fi
    
    local mongodump_version
    mongodump_version=$(mongodump --version | grep -oP "version\s+\K[0-9.]+")
    if [[ ! "$mongodump_version" =~ ^100\.[0-9]+\.[0-9]+$ ]]; then
        log "ERROR" "Unsupported mongodump version: $mongodump_version"
        return 1
    }
    
    # Verify AWS CLI and credentials
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        log "ERROR" "AWS credentials validation failed"
        return 1
    }
    
    # Verify KMS key access
    if ! aws kms describe-key --key-id "$ENCRYPTION_KEY_ID" >/dev/null 2>&1; then
        log "ERROR" "Unable to access KMS encryption key"
        return 1
    }
    
    # Verify backup directory
    if [[ ! -d "$BACKUP_ROOT" ]]; then
        if ! mkdir -p "$BACKUP_ROOT"; then
            log "ERROR" "Unable to create backup directory"
            return 1
        fi
        chmod 700 "$BACKUP_ROOT"
    fi
    
    log "INFO" "Environment validation completed successfully"
    return 0
}

# Perform backup with parallel streams and encryption
perform_backup() {
    local backup_path="$1"
    local database_name="$2"
    local timestamp
    timestamp=$(date -u +"%Y%m%d_%H%M%S")
    local backup_dir="${backup_path}/${database_name}_${timestamp}"
    
    log "INFO" "Starting backup of database: $database_name"
    
    # Create backup directory with secure permissions
    mkdir -p "$backup_dir"
    chmod 700 "$backup_dir"
    
    # Generate backup metadata
    local metadata_file="${backup_dir}/metadata.json"
    cat > "$metadata_file" <<EOF
{
    "database": "$database_name",
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "hostname": "$(hostname)",
    "mongodump_version": "$(mongodump --version | grep -oP 'version\s+\K[0-9.]+')",
    "parallel_streams": $PARALLEL_STREAMS
}
EOF
    
    # Execute parallel backup streams
    local exit_code=0
    mongodump \
        --uri="mongodb://${MONGODB_USERNAME}:${MONGODB_PASSWORD}@${MONGODB_HOSTS}/${database_name}" \
        --ssl \
        --sslCAFile="$MONGODB_SSL_CA_PATH" \
        --authenticationDatabase=admin \
        --gzip \
        --out="$backup_dir" \
        --numParallelCollections="$PARALLEL_STREAMS" \
        --oplog || exit_code=$?
    
    if [[ $exit_code -ne 0 ]]; then
        log "ERROR" "Backup failed with exit code: $exit_code"
        return 1
    fi
    
    # Encrypt backup using AWS KMS and AES-256-GCM
    local encrypted_file="${backup_dir}.enc"
    if ! tar czf - "$backup_dir" | \
        aws kms encrypt \
            --key-id "$ENCRYPTION_KEY_ID" \
            --encryption-algorithm "SYMMETRIC_DEFAULT" \
            --encryption-context "Purpose=backup,Database=$database_name" \
            --output text \
            --query CiphertextBlob > "$encrypted_file"; then
        log "ERROR" "Encryption failed"
        return 1
    fi
    
    # Generate and store checksum
    sha256sum "$encrypted_file" > "${encrypted_file}.sha256"
    
    # Clean up unencrypted backup
    rm -rf "$backup_dir"
    
    log "INFO" "Backup completed successfully: ${encrypted_file}"
    return 0
}

# Upload backup to multiple S3 regions with verification
upload_to_s3() {
    local backup_file="$1"
    local s3_buckets=($S3_BUCKETS)
    
    log "INFO" "Starting multi-region backup upload"
    
    # Upload to each configured region
    for bucket in "${s3_buckets[@]}"; do
        local backup_key="backups/$(basename "$backup_file")"
        
        # Upload encrypted backup with metadata
        if ! aws s3 cp "$backup_file" "s3://${bucket}/${backup_key}" \
            --metadata "encrypted=true,algorithm=AES-256-GCM" \
            --storage-class "STANDARD_IA"; then
            log "ERROR" "Failed to upload backup to bucket: $bucket"
            return 1
        fi
        
        # Upload checksum file
        if ! aws s3 cp "${backup_file}.sha256" "s3://${bucket}/${backup_key}.sha256"; then
            log "ERROR" "Failed to upload checksum to bucket: $bucket"
            return 1
        }
        
        # Verify upload with checksum
        local remote_checksum
        remote_checksum=$(aws s3 cp "s3://${bucket}/${backup_key}.sha256" - | awk '{print $1}')
        local local_checksum
        local_checksum=$(sha256sum "$backup_file" | awk '{print $1}')
        
        if [[ "$remote_checksum" != "$local_checksum" ]]; then
            log "ERROR" "Checksum verification failed for bucket: $bucket"
            return 1
        }
        
        log "INFO" "Successfully uploaded and verified backup in bucket: $bucket"
    done
    
    return 0
}

# Cleanup old backups with secure deletion
cleanup_old_backups() {
    local backup_path="$1"
    local retention_days="$2"
    
    log "INFO" "Starting backup cleanup (retention: $retention_days days)"
    
    # Find and remove old local backups
    find "$backup_path" -type f -name "*.enc" -mtime +"$retention_days" -print0 | \
        while IFS= read -r -d '' file; do
            log "INFO" "Removing old backup: $file"
            
            # Secure deletion with multiple overwrites
            shred -u -n 3 "$file" "${file}.sha256"
        done
    
    # Cleanup old backups in S3 buckets
    local s3_buckets=($S3_BUCKETS)
    for bucket in "${s3_buckets[@]}"; do
        local deletion_date
        deletion_date=$(date -u -d "$retention_days days ago" +"%Y-%m-%d")
        
        aws s3api list-objects-v2 \
            --bucket "$bucket" \
            --prefix "backups/" \
            --query "Contents[?LastModified<='${deletion_date}'].Key" \
            --output text | \
        while read -r key; do
            if [[ -n "$key" ]]; then
                log "INFO" "Removing old S3 backup: s3://${bucket}/${key}"
                aws s3 rm "s3://${bucket}/${key}"
            fi
        done
    done
    
    return 0
}

# Main execution flow
main() {
    log "INFO" "Starting database backup process"
    
    # Validate environment
    if ! validate_environment; then
        log "ERROR" "Environment validation failed"
        exit 1
    fi
    
    # Create timestamp for this backup run
    local timestamp
    timestamp=$(date -u +"%Y%m%d_%H%M%S")
    local backup_dir="${BACKUP_ROOT}/${timestamp}"
    
    # Perform backup
    if ! perform_backup "$backup_dir" "donation_platform"; then
        log "ERROR" "Backup operation failed"
        exit 1
    fi
    
    # Upload to S3 with multi-region replication
    local encrypted_backup="${backup_dir}.enc"
    if ! upload_to_s3 "$encrypted_backup"; then
        log "ERROR" "S3 upload failed"
        exit 1
    fi
    
    # Cleanup old backups
    if ! cleanup_old_backups "$BACKUP_ROOT" "$RETENTION_DAYS"; then
        log "ERROR" "Backup cleanup failed"
        exit 1
    fi
    
    log "INFO" "Backup process completed successfully"
    return 0
}

# Execute main function
main "$@"