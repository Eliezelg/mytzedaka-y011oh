#!/bin/bash

# International Jewish Association Donation Platform
# Kubernetes Cluster Initialization Script
# Version: 1.0.0
# Required tools:
# - kubectl v1.25+ 
# - helm v3.0+

set -euo pipefail

# Global variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_BASE_DIR="${SCRIPT_DIR}/../k8s/base"
LOG_FILE="/var/log/cluster-init.log"
REQUIRED_TOOLS=("kubectl" "helm")

# Default values
DEFAULT_CLUSTER_NAME="ijadp-cluster"
DEFAULT_ENVIRONMENT="prod"
DEFAULT_NAMESPACE="ijadp"
DEFAULT_LOG_LEVEL="INFO"
DEFAULT_BACKUP_RETENTION_DAYS=30

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging functions
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "${LOG_FILE}"
}

log_info() {
    log "INFO" "$1"
}

log_error() {
    log "ERROR" "$1"
}

log_warning() {
    log "WARNING" "$1"
}

# Pre-flight checks
check_prerequisites() {
    log_info "Performing pre-flight checks..."
    
    # Check for required tools
    for tool in "${REQUIRED_TOOLS[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Required tool '$tool' is not installed"
            return 1
        fi
        
        if [ "$tool" = "kubectl" ]; then
            version=$(kubectl version --client -o json | jq -r '.clientVersion.gitVersion')
            if [[ ! "$version" =~ v1\.[2-9][5-9] ]]; then
                log_error "kubectl version must be 1.25 or higher. Found: $version"
                return 1
            fi
        fi
    done
    
    # Check for required files
    local required_files=("namespace.yaml" "secrets.yaml" "configmap.yaml" "network-policy.yaml")
    for file in "${required_files[@]}"; do
        if [ ! -f "${K8S_BASE_DIR}/${file}" ]; then
            log_error "Required file '${file}' not found in ${K8S_BASE_DIR}"
            return 1
        fi
    done
    
    return 0
}

# Initialize cluster
init_cluster() {
    local cluster_name=${1:-$DEFAULT_CLUSTER_NAME}
    local environment=${2:-$DEFAULT_ENVIRONMENT}
    local region=${3:-"us-east-1"}
    
    log_info "Initializing cluster '${cluster_name}' in ${environment} environment (${region})"
    
    # Create namespaces
    kubectl apply -f "${K8S_BASE_DIR}/namespace.yaml"
    
    # Configure RBAC
    configure_rbac "${environment}"
    
    # Setup security configurations
    if ! configure_security "${environment}" "${cluster_name}"; then
        log_error "Security configuration failed"
        return 1
    fi
    
    # Setup monitoring
    if ! setup_monitoring "${DEFAULT_NAMESPACE}"; then
        log_warning "Monitoring setup encountered issues"
    fi
    
    # Setup logging
    if ! setup_logging "${DEFAULT_NAMESPACE}" "${DEFAULT_BACKUP_RETENTION_DAYS}"; then
        log_warning "Logging setup encountered issues"
    fi
    
    # Validate cluster health
    validate_cluster_health
    
    return 0
}

# Configure security measures
configure_security() {
    local environment=$1
    local cluster_name=$2
    
    log_info "Configuring security measures for ${environment} environment"
    
    # Apply network policies
    kubectl apply -f "${K8S_BASE_DIR}/network-policy.yaml"
    
    # Configure pod security policies
    cat <<EOF | kubectl apply -f -
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: restricted-psp
spec:
  privileged: false
  seLinux:
    rule: RunAsAny
  runAsUser:
    rule: MustRunAsNonRoot
  fsGroup:
    rule: RunAsAny
  volumes:
  - 'configMap'
  - 'emptyDir'
  - 'projected'
  - 'secret'
  - 'downwardAPI'
  - 'persistentVolumeClaim'
EOF
    
    # Setup TLS certificates
    setup_cert_manager
    
    # Configure secrets encryption
    kubectl apply -f "${K8S_BASE_DIR}/secrets.yaml"
    
    return 0
}

# Setup monitoring stack
setup_monitoring() {
    local namespace=$1
    
    log_info "Setting up monitoring stack in namespace ${namespace}"
    
    # Add Prometheus helm repo
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update
    
    # Install Prometheus Operator
    helm install prometheus prometheus-community/kube-prometheus-stack \
        --namespace "${namespace}" \
        --set grafana.enabled=true \
        --set prometheus.prometheusSpec.retention=15d \
        --set prometheus.prometheusSpec.resources.requests.memory=512Mi \
        --set alertmanager.enabled=true
        
    # Setup custom financial dashboards
    kubectl apply -f "${K8S_BASE_DIR}/monitoring/dashboards/"
    
    return 0
}

# Setup logging infrastructure
setup_logging() {
    local namespace=$1
    local retention_days=$2
    
    log_info "Setting up logging infrastructure in namespace ${namespace}"
    
    # Add Elastic helm repo
    helm repo add elastic https://helm.elastic.co
    helm repo update
    
    # Install Elasticsearch
    helm install elasticsearch elastic/elasticsearch \
        --namespace "${namespace}" \
        --set replicas=3 \
        --set resources.requests.memory=2Gi \
        --set volumeClaimTemplate.resources.requests.storage=100Gi
        
    # Install Kibana
    helm install kibana elastic/kibana \
        --namespace "${namespace}" \
        --set resources.requests.memory=1Gi
        
    # Configure log retention
    configure_log_retention "${retention_days}"
    
    return 0
}

# Validate cluster health
validate_cluster_health() {
    log_info "Validating cluster health..."
    
    # Check node status
    kubectl get nodes -o wide
    
    # Check core services
    kubectl get pods -A -o wide
    
    # Check monitoring stack
    kubectl get pods -n "${DEFAULT_NAMESPACE}" -l app=prometheus
    kubectl get pods -n "${DEFAULT_NAMESPACE}" -l app=grafana
    
    # Check logging stack
    kubectl get pods -n "${DEFAULT_NAMESPACE}" -l app=elasticsearch
    kubectl get pods -n "${DEFAULT_NAMESPACE}" -l app=kibana
    
    return 0
}

# Main execution
main() {
    local cluster_name=${1:-$DEFAULT_CLUSTER_NAME}
    local environment=${2:-$DEFAULT_ENVIRONMENT}
    local region=${3:-"us-east-1"}
    
    # Create log file if it doesn't exist
    touch "${LOG_FILE}"
    
    log_info "Starting cluster initialization script"
    
    # Perform pre-flight checks
    if ! check_prerequisites; then
        log_error "Pre-flight checks failed. Aborting."
        exit 1
    fi
    
    # Initialize cluster
    if ! init_cluster "${cluster_name}" "${environment}" "${region}"; then
        log_error "Cluster initialization failed"
        exit 1
    fi
    
    log_info "Cluster initialization completed successfully"
    exit 0
}

# Execute main function with provided arguments
main "$@"