#!/bin/bash

# SSL/TLS Certificate Management Script for International Jewish Association Donation Platform
# Version: 1.0.0
# Dependencies:
# - aws-cli v2.0+
# - openssl v1.1.1+

set -euo pipefail

# Global Constants
CERT_PATH="/etc/ssl/certs"
KEY_PATH="/etc/ssl/private"
DOMAINS=("*.ijap.org" "ijap.org")
AWS_REGIONS=("us-east-1" "eu-west-1" "ap-southeast-1")
ECDSA_CURVE="prime256v1"
TLS_POLICY="TLSv1.3"
BACKUP_PATH="/etc/ssl/backup"
RETRY_COUNT=3
PARALLEL_LIMIT=5

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Validation functions
validate_dependencies() {
    local missing_deps=()
    
    if ! command -v aws >/dev/null 2>&1; then
        missing_deps+=("aws-cli")
    fi
    
    if ! command -v openssl >/dev/null 2>&1; then
        missing_deps+=("openssl")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Missing required dependencies: ${missing_deps[*]}"
        exit 1
    fi
}

validate_environment() {
    if [ -z "${AWS_PROFILE:-}" ]; then
        log_error "AWS_PROFILE environment variable not set"
        exit 1
    fi
    
    if [ -z "${ENVIRONMENT:-}" ]; then
        log_warn "ENVIRONMENT not set, defaulting to 'development'"
        export ENVIRONMENT="development"
    fi
}

# Certificate generation function
generate_certificates() {
    local domain_name=$1
    local output_path=$2
    local key_curve=${3:-$ECDSA_CURVE}
    local backup_existing=${4:-true}
    local timestamp=$(date +%Y%m%d_%H%M%S)
    
    if [ "$backup_existing" = true ] && [ -f "$output_path/$domain_name.crt" ]; then
        mkdir -p "$BACKUP_PATH/$timestamp"
        cp "$output_path/$domain_name.crt" "$BACKUP_PATH/$timestamp/"
        cp "$KEY_PATH/$domain_name.key" "$BACKUP_PATH/$timestamp/"
        log_info "Existing certificates backed up to $BACKUP_PATH/$timestamp"
    fi
    
    # Generate ECDSA private key
    openssl ecparam -genkey -name "$key_curve" -out "$KEY_PATH/$domain_name.key"
    chmod 600 "$KEY_PATH/$domain_name.key"
    
    # Generate CSR with SAN
    cat > "$output_path/$domain_name.cnf" <<EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
req_extensions = req_ext
distinguished_name = dn

[dn]
CN = $domain_name
O = International Jewish Association Donation Platform
OU = Security Operations
C = IL

[req_ext]
subjectAltName = @alt_names

[alt_names]
EOF
    
    # Add domains to SAN
    local i=1
    for domain in "${DOMAINS[@]}"; do
        echo "DNS.$i = $domain" >> "$output_path/$domain_name.cnf"
        ((i++))
    done
    
    # Generate CSR
    openssl req -new -key "$KEY_PATH/$domain_name.key" \
        -out "$output_path/$domain_name.csr" \
        -config "$output_path/$domain_name.cnf"
    
    # Generate self-signed certificate for development
    if [ "$ENVIRONMENT" = "development" ]; then
        openssl x509 -req -days 365 \
            -in "$output_path/$domain_name.csr" \
            -signkey "$KEY_PATH/$domain_name.key" \
            -out "$output_path/$domain_name.crt" \
            -extensions req_ext \
            -extfile "$output_path/$domain_name.cnf"
    fi
    
    # Validate certificate
    openssl verify -CAfile "$output_path/$domain_name.crt" "$output_path/$domain_name.crt"
    
    log_info "Certificate generation completed for $domain_name"
    return 0
}

# AWS ACM upload function with parallel processing
upload_to_acm() {
    local cert_path=$1
    local key_path=$2
    local region=$3
    local tags=$4
    local retries=0
    
    while [ $retries -lt $RETRY_COUNT ]; do
        if aws acm import-certificate \
            --certificate fileb://"$cert_path" \
            --private-key fileb://"$key_path" \
            --region "$region" \
            --tags "$tags" 2>/dev/null; then
            
            log_info "Certificate uploaded successfully to ACM in $region"
            return 0
        fi
        
        ((retries++))
        log_warn "Retry $retries/$RETRY_COUNT for ACM upload in $region"
        sleep $((2 ** retries))
    done
    
    log_error "Failed to upload certificate to ACM in $region after $RETRY_COUNT retries"
    return 1
}

# Parallel upload to multiple regions
upload_certificates_parallel() {
    local cert_path=$1
    local key_path=$2
    local tags=$3
    local pids=()
    
    for region in "${AWS_REGIONS[@]}"; do
        while [ ${#pids[@]} -ge $PARALLEL_LIMIT ]; do
            for pid in "${pids[@]}"; do
                if ! kill -0 $pid 2>/dev/null; then
                    pids=("${pids[@]/$pid}")
                fi
            done
            sleep 1
        done
        
        upload_to_acm "$cert_path" "$key_path" "$region" "$tags" &
        pids+=($!)
    done
    
    # Wait for all uploads to complete
    for pid in "${pids[@]}"; do
        wait $pid
    done
}

# CloudFront SSL configuration
configure_cloudfront() {
    local distribution_id=$1
    local cert_arn=$2
    
    aws cloudfront update-distribution \
        --id "$distribution_id" \
        --distribution-config "{
            \"ViewerCertificate\": {
                \"ACMCertificateArn\": \"$cert_arn\",
                \"SSLSupportMethod\": \"sni-only\",
                \"MinimumProtocolVersion\": \"$TLS_POLICY\"
            }
        }"
    
    log_info "CloudFront distribution $distribution_id updated with new certificate"
}

# Nginx SSL configuration
setup_nginx_ssl() {
    local cert_path=$1
    local key_path=$2
    local nginx_conf="/etc/nginx/conf.d/ssl.conf"
    
    # Backup existing configuration
    if [ -f "$nginx_conf" ]; then
        cp "$nginx_conf" "$nginx_conf.bak"
    fi
    
    # Create new SSL configuration
    cat > "$nginx_conf" <<EOF
ssl_protocols TLSv1.3;
ssl_prefer_server_ciphers on;
ssl_ciphers ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305;
ssl_ecdh_curve $ECDSA_CURVE;
ssl_session_timeout 1d;
ssl_session_cache shared:SSL:50m;
ssl_session_tickets off;
ssl_certificate $cert_path;
ssl_certificate_key $key_path;
ssl_stapling on;
ssl_stapling_verify on;
add_header Strict-Transport-Security "max-age=63072000" always;
EOF
    
    # Test Nginx configuration
    nginx -t
    
    # Reload Nginx
    systemctl reload nginx
    
    log_info "Nginx SSL configuration updated successfully"
}

# Main execution
main() {
    validate_dependencies
    validate_environment
    
    local domain="ijap.org"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    
    # Create required directories
    mkdir -p "$CERT_PATH" "$KEY_PATH" "$BACKUP_PATH"
    
    # Generate certificates
    if ! generate_certificates "$domain" "$CERT_PATH"; then
        log_error "Certificate generation failed"
        exit 1
    fi
    
    # Upload to ACM if not in development
    if [ "$ENVIRONMENT" != "development" ]; then
        local tags="Key=Environment,Value=$ENVIRONMENT Key=ManagedBy,Value=ssl-setup"
        
        if [ "${PARALLEL_UPLOAD_ENABLED:-true}" = true ]; then
            upload_certificates_parallel "$CERT_PATH/$domain.crt" "$KEY_PATH/$domain.key" "$tags"
        else
            for region in "${AWS_REGIONS[@]}"; do
                upload_to_acm "$CERT_PATH/$domain.crt" "$KEY_PATH/$domain.key" "$region" "$tags"
            done
        fi
    fi
    
    # Configure Nginx
    setup_nginx_ssl "$CERT_PATH/$domain.crt" "$KEY_PATH/$domain.key"
    
    log_info "SSL setup completed successfully"
}

# Execute main function with error handling
if [ "${DEBUG_MODE:-false}" = true ]; then
    set -x
fi

main "$@"