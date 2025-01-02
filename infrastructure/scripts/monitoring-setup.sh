#!/bin/bash

# Monitoring Setup Script for International Jewish Association Donation Platform
# Version: 1.0.0
# Dependencies:
# - kubectl v1.24+
# - helm v3.0+

set -euo pipefail

# Global variables
readonly MONITORING_NAMESPACE="monitoring"
readonly PROMETHEUS_VERSION="v2.42.0"
readonly GRAFANA_VERSION="9.5.0"
readonly JAEGER_VERSION="1.42.0"
readonly RETENTION_PERIOD="30d"
readonly SCRAPE_INTERVAL="15s"
readonly EVALUATION_INTERVAL="15s"

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        exit 1
    fi
    
    # Check helm
    if ! command -v helm &> /dev/null; then
        log_error "helm is not installed"
        exit 1
    }
    
    # Check cluster access
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Unable to access Kubernetes cluster"
        exit 1
    }
}

# Setup monitoring namespace with enhanced configuration
setup_monitoring_namespace() {
    log_info "Setting up monitoring namespace..."
    
    # Create namespace if not exists
    kubectl create namespace ${MONITORING_NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -
    
    # Apply resource quotas
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ResourceQuota
metadata:
  name: monitoring-quota
  namespace: ${MONITORING_NAMESPACE}
spec:
  hard:
    requests.cpu: "8"
    requests.memory: "16Gi"
    limits.cpu: "16"
    limits.memory: "32Gi"
    persistentvolumeclaims: "10"
EOF
    
    # Apply network policies
    cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: monitoring-network-policy
  namespace: ${MONITORING_NAMESPACE}
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: default
  egress:
  - to:
    - namespaceSelector: {}
EOF
}

# Deploy and configure Prometheus
deploy_prometheus() {
    log_info "Deploying Prometheus..."
    
    # Apply Prometheus ConfigMap
    kubectl apply -f ../k8s/monitoring/prometheus/configmap.yaml
    
    # Create storage class if not exists
    kubectl apply -f - <<EOF
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: prometheus-storage
  namespace: ${MONITORING_NAMESPACE}
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 50Gi
EOF
    
    # Deploy Prometheus
    kubectl apply -f ../k8s/monitoring/prometheus/deployment.yaml
    
    # Wait for Prometheus to be ready
    kubectl rollout status deployment/prometheus -n ${MONITORING_NAMESPACE} --timeout=300s
}

# Deploy and configure Grafana
deploy_grafana() {
    log_info "Deploying Grafana..."
    
    # Generate secure credentials
    ADMIN_PASSWORD=$(openssl rand -base64 32)
    
    # Apply Grafana ConfigMap
    kubectl apply -f ../k8s/monitoring/grafana/configmap.yaml
    
    # Create Grafana secrets
    kubectl create secret generic grafana-credentials \
        --from-literal=admin-user=admin \
        --from-literal=admin-password=${ADMIN_PASSWORD} \
        --namespace ${MONITORING_NAMESPACE} \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Deploy Grafana
    kubectl apply -f ../k8s/monitoring/grafana/deployment.yaml
    
    # Wait for Grafana to be ready
    kubectl rollout status deployment/grafana -n ${MONITORING_NAMESPACE} --timeout=300s
    
    log_info "Grafana admin password: ${ADMIN_PASSWORD}"
}

# Deploy and configure Jaeger
deploy_jaeger() {
    log_info "Deploying Jaeger..."
    
    # Apply Jaeger ConfigMap
    kubectl apply -f ../k8s/monitoring/jaeger/configmap.yaml
    
    # Deploy Jaeger using Helm
    helm repo add jaegertracing https://jaegertracing.github.io/helm-charts
    helm repo update
    
    helm upgrade --install jaeger jaegertracing/jaeger \
        --namespace ${MONITORING_NAMESPACE} \
        --version ${JAEGER_VERSION} \
        --set collector.service.annotations."prometheus\.io/scrape"="true" \
        --set collector.service.annotations."prometheus\.io/port"="14269"
    
    # Wait for Jaeger to be ready
    kubectl rollout status deployment/jaeger-collector -n ${MONITORING_NAMESPACE} --timeout=300s
}

# Verify monitoring stack deployment
verify_monitoring_stack() {
    log_info "Verifying monitoring stack deployment..."
    
    # Check pod status
    kubectl get pods -n ${MONITORING_NAMESPACE} -o wide
    
    # Verify Prometheus targets
    local PROMETHEUS_POD=$(kubectl get pods -n ${MONITORING_NAMESPACE} -l app=prometheus -o jsonpath="{.items[0].metadata.name}")
    kubectl port-forward -n ${MONITORING_NAMESPACE} ${PROMETHEUS_POD} 9090:9090 &
    PF_PID=$!
    sleep 5
    
    # Check Prometheus targets
    curl -s http://localhost:9090/api/v1/targets | grep "health"
    kill ${PF_PID}
    
    # Verify Grafana
    local GRAFANA_POD=$(kubectl get pods -n ${MONITORING_NAMESPACE} -l app=grafana -o jsonpath="{.items[0].metadata.name}")
    kubectl port-forward -n ${MONITORING_NAMESPACE} ${GRAFANA_POD} 3000:3000 &
    PF_PID=$!
    sleep 5
    
    # Check Grafana health
    curl -s http://localhost:3000/api/health | grep "ok"
    kill ${PF_PID}
    
    log_info "Monitoring stack verification completed"
}

# Main setup function
main() {
    log_info "Starting monitoring stack setup..."
    
    check_prerequisites
    setup_monitoring_namespace
    deploy_prometheus
    deploy_grafana
    deploy_jaeger
    verify_monitoring_stack
    
    log_info "Monitoring stack setup completed successfully"
}

# Execute main function
main "$@"