#!/usr/bin/env bash

# International Jewish Association Donation Platform
# Database Restore Script v1.0
# Handles multi-region MongoDB Atlas restore with HSM encryption and validation
# Dependencies:
# - mongodb-database-tools v100.7.0
# - aws-cli v2.0
# - datadog-agent v7.0

set -euo pipefail
IFS=$'\n\t'

# Global Constants
readonly RESTORE_ROOT="/var/restore/mongodb"
readonly LOG_FILE="/var/log/mongodb/restore.log"
readonly TIMESTAMP=$(date +%Y%m%d_%H%M%S)
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Logging Configuration
exec 1> >(tee -a "${LOG_FILE}")
exec 2> >(tee -a "${LOG_FILE}" >&2)

log() {
    local level=$1
    shift
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [${level}] $*"
    
    # Send metrics to DataDog
    /usr/bin/datadog-agent metric submit "mongodb.restore.log" 1 --type count --tags "level:${level}"
}

# Validate environment and dependencies
validate_environment() {
    log "INFO" "Validating environment and dependencies..."
    
    # Required environment variables
    local required_vars=(
        "MONGODB_URI"
        "AWS_REGION"
        "HSM_KEY_ID"
        "S3_BUCKET"
        "DATADOG_API_KEY"
        "PRIMARY_REGION"
        "FALLBACK_REGION"
    )

    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log "ERROR" "Missing required environment variable: ${var}"
            return 1
        fi
    done

    # Verify mongorestore version
    if ! command -v mongorestore >/dev/null 2>&1; then
        log "ERROR" "mongorestore not found. Please install mongodb-database-tools v100.7.0"
        return 1
    fi

    # Verify AWS CLI
    if ! aws --version >/dev/null 2>&1; then
        log "ERROR" "AWS CLI not found. Please install aws-cli v2.0"
        return 1
    }

    # Verify DataDog agent
    if ! /usr/bin/datadog-agent status >/dev/null 2>&1; then
        log "ERROR" "DataDog agent not running"
        return 1
    }

    # Verify HSM key accessibility
    if ! aws kms describe-key --key-id "${HSM_KEY_ID}" >/dev/null 2>&1; then
        log "ERROR" "Cannot access HSM key"
        return 1
    }

    # Verify restore directory
    mkdir -p "${RESTORE_ROOT}"
    if [[ ! -w "${RESTORE_ROOT}" ]]; then
        log "ERROR" "Cannot write to restore directory: ${RESTORE_ROOT}"
        return 1
    }

    log "INFO" "Environment validation successful"
    return 0
}

# Download and decrypt backup from S3
download_from_s3() {
    local primary_s3_path=$1
    local fallback_s3_path=$2
    local local_restore_path=$3
    local hsm_key_id=$4
    
    log "INFO" "Attempting to download backup from primary region..."
    
    # Try primary region first
    if aws s3 cp "s3://${S3_BUCKET}/${primary_s3_path}" "${local_restore_path}.enc" \
        --region "${PRIMARY_REGION}"; then
        log "INFO" "Successfully downloaded from primary region"
    else
        log "WARN" "Primary region download failed, failing over to secondary region..."
        
        # Fallback to secondary region
        if ! aws s3 cp "s3://${S3_BUCKET}/${fallback_s3_path}" "${local_restore_path}.enc" \
            --region "${FALLBACK_REGION}"; then
            log "ERROR" "Failed to download backup from both regions"
            return 1
        fi
    fi

    # Verify backup file integrity
    local expected_sha256=$(aws s3api head-object \
        --bucket "${S3_BUCKET}" \
        --key "${primary_s3_path}" \
        --query Metadata.sha256 \
        --output text)
    
    local actual_sha256=$(sha256sum "${local_restore_path}.enc" | cut -d' ' -f1)
    
    if [[ "${expected_sha256}" != "${actual_sha256}" ]]; then
        log "ERROR" "Backup file integrity check failed"
        return 1
    fi

    # Decrypt backup using HSM
    log "INFO" "Decrypting backup file..."
    if ! aws kms decrypt \
        --key-id "${hsm_key_id}" \
        --ciphertext-blob "fileb://${local_restore_path}.enc" \
        --output text \
        --query Plaintext \
        > "${local_restore_path}"; then
        log "ERROR" "Failed to decrypt backup file"
        return 1
    fi

    rm -f "${local_restore_path}.enc"
    log "INFO" "Successfully downloaded and decrypted backup"
    return 0
}

# Perform database restore
perform_restore() {
    local restore_path=$1
    local database_name=$2
    local parallel_collections=${3:-4}
    
    log "INFO" "Starting database restore process..."

    # Stop dependent services
    log "INFO" "Stopping dependent services..."
    systemctl stop application-api || log "WARN" "Failed to stop application-api"
    
    # Calculate optimal number of parallel workers
    local cpu_cores=$(nproc)
    local parallel_workers=$((cpu_cores / 2))
    [[ ${parallel_workers} -lt 2 ]] && parallel_workers=2
    
    # Execute restore with parallel processing
    log "INFO" "Executing mongorestore with ${parallel_workers} workers..."
    
    if ! mongorestore \
        --uri="${MONGODB_URI}" \
        --db="${database_name}" \
        --dir="${restore_path}" \
        --numParallelCollections=${parallel_workers} \
        --preserveUUID \
        --oplogReplay \
        --writeConcern="majority" \
        --maintainInsertionOrder; then
        log "ERROR" "Database restore failed"
        return 1
    fi

    # Rebuild indexes
    log "INFO" "Rebuilding indexes..."
    mongosh "${MONGODB_URI}/${database_name}" --eval "db.getCollectionNames().forEach(function(col) { db[col].reIndex() })"

    # Restart dependent services
    log "INFO" "Restarting dependent services..."
    systemctl start application-api || log "ERROR" "Failed to start application-api"

    log "INFO" "Database restore completed successfully"
    return 0
}

# Validate restored database
validate_restore() {
    local database_name=$1
    
    log "INFO" "Starting database validation..."

    # Connect to database and perform validation
    local validation_script="
    const collections = db.getCollectionNames();
    let valid = true;
    
    collections.forEach(function(collection) {
        print('Validating collection: ' + collection);
        const result = db[collection].validate(true);
        if (!result.valid) {
            valid = false;
            print('Validation failed for collection: ' + collection);
            printjson(result);
        }
    });
    
    if (!valid) {
        quit(1);
    }
    "

    if ! mongosh "${MONGODB_URI}/${database_name}" --eval "${validation_script}"; then
        log "ERROR" "Database validation failed"
        return 1
    }

    # Verify replication status
    log "INFO" "Verifying replication status..."
    if ! mongosh "${MONGODB_URI}/admin" --eval "rs.status()" | grep -q '"ok" : 1'; then
        log "ERROR" "Replication status check failed"
        return 1
    }

    # Generate validation report
    local report_path="${RESTORE_ROOT}/validation_${TIMESTAMP}.json"
    mongosh "${MONGODB_URI}/${database_name}" \
        --eval "JSON.stringify(db.stats(), null, 2)" > "${report_path}"

    log "INFO" "Database validation completed successfully"
    return 0
}

# Main execution flow
main() {
    log "INFO" "Starting database restore process..."
    
    # Validate environment
    if ! validate_environment; then
        log "ERROR" "Environment validation failed"
        exit 1
    }

    # Create restore directory for this run
    local restore_dir="${RESTORE_ROOT}/${TIMESTAMP}"
    mkdir -p "${restore_dir}"

    # Download and decrypt backup
    if ! download_from_s3 \
        "backups/latest/mongodb.tar.gz" \
        "backups/latest/mongodb.tar.gz" \
        "${restore_dir}/backup.tar.gz" \
        "${HSM_KEY_ID}"; then
        log "ERROR" "Backup download failed"
        exit 1
    }

    # Extract backup
    tar -xzf "${restore_dir}/backup.tar.gz" -C "${restore_dir}"

    # Perform restore
    if ! perform_restore "${restore_dir}/dump" "donation_platform"; then
        log "ERROR" "Database restore failed"
        exit 1
    }

    # Validate restore
    if ! validate_restore "donation_platform"; then
        log "ERROR" "Database validation failed"
        exit 1
    }

    # Cleanup
    rm -rf "${restore_dir}"
    
    log "INFO" "Database restore completed successfully"
    
    # Send final success metric to DataDog
    /usr/bin/datadog-agent metric submit "mongodb.restore.success" 1 --type count
}

# Execute main function
main "$@"