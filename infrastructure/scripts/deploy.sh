#!/usr/bin/env bash

# International Jewish Association Donation Platform Deployment Script
# Version: 1.0.0
# Kubernetes CLI version: 1.25+
# Kustomize CLI version: 4.5+

set -euo pipefail

# Global Configuration
readonly ENVIRONMENTS=("dev" "staging" "prod")
readonly SERVICES=("api" "web" "worker" "cache")
readonly HEALTH_CHECK_RETRIES=5
readonly HEALTH_CHECK_INTERVAL=10
readonly DEPLOYMENT_TIMEOUT=600
readonly ROLLBACK_THRESHOLD=0.95
readonly SECURITY_CONTEXT='{
  "runAsNonRoot": true,
  "readOnlyRootFilesystem": true
}'

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m'

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

# Validation functions
validate_environment() {
    local env=$1
    if [[ ! " ${ENVIRONMENTS[@]} " =~ " ${env} " ]]; then
        log_error "Invalid environment: $env"
        log_info "Valid environments: ${ENVIRONMENTS[*]}"
        exit 1
    fi
}

validate_kubernetes_context() {
    if ! kubectl config current-context &>/dev/null; then
        log_error "No Kubernetes context found"
        exit 1
    fi
}

verify_deployment_prerequisites() {
    local env=$1
    local namespace=$2

    # Check required tools
    command -v kubectl >/dev/null 2>&1 || { log_error "kubectl is required but not installed"; exit 1; }
    command -v kustomize >/dev/null 2>&1 || { log_error "kustomize is required but not installed"; exit 1; }

    # Verify cluster access
    if ! kubectl auth can-i create deployments --namespace="$namespace" &>/dev/null; then
        log_error "Insufficient permissions to deploy to namespace: $namespace"
        exit 1
    }

    # Verify namespace exists or create it
    if ! kubectl get namespace "$namespace" &>/dev/null; then
        log_info "Creating namespace: $namespace"
        kubectl apply -f ../k8s/base/namespace.yaml
    fi
}

# Health check functions
verify_health() {
    local namespace=$1
    local service=$2
    local retries=$HEALTH_CHECK_RETRIES

    while [ $retries -gt 0 ]; do
        if kubectl rollout status deployment/"$service" -n "$namespace" --timeout=30s &>/dev/null; then
            log_info "Health check passed for $service"
            return 0
        fi
        retries=$((retries-1))
        log_warn "Health check failed for $service, retrying... ($retries attempts left)"
        sleep $HEALTH_CHECK_INTERVAL
    done

    log_error "Health check failed for $service after $HEALTH_CHECK_RETRIES attempts"
    return 1
}

# Deployment functions
deploy_environment() {
    local env=$1
    local namespace=$2
    local version=${3:-latest}

    validate_environment "$env"
    verify_deployment_prerequisites "$env" "$namespace"

    log_info "Starting deployment for environment: $env"

    # Apply security policies
    log_info "Applying network policies"
    kubectl apply -f ../k8s/base/network-policy.yaml -n "$namespace"

    # Apply ConfigMaps and Secrets
    log_info "Applying ConfigMaps and Secrets"
    kubectl apply -k ../k8s/base -n "$namespace"

    # Deploy services with blue-green strategy
    for service in "${SERVICES[@]}"; do
        deploy_service "$service" "$namespace" "$version"
    done

    log_info "Deployment completed successfully"
}

deploy_service() {
    local service=$1
    local namespace=$2
    local version=$3

    log_info "Deploying $service service"

    # Create blue deployment
    local blue_deployment="${service}-blue"
    local green_deployment="${service}-green"

    # Apply deployment with kustomize
    kustomize build "../k8s/apps/$service" | \
        sed "s/\${VERSION}/$version/g" | \
        sed "s/\${ENVIRONMENT}/$namespace/g" | \
        kubectl apply -n "$namespace" -f -

    # Wait for deployment to be ready
    if ! verify_health "$namespace" "$service"; then
        log_error "Deployment failed for $service"
        rollback_deployment "$service" "$namespace"
        exit 1
    fi

    log_info "$service deployed successfully"
}

rollback_deployment() {
    local service=$1
    local namespace=$2

    log_warn "Initiating rollback for $service in $namespace"

    # Rollback to previous revision
    kubectl rollout undo deployment/"$service" -n "$namespace"

    # Verify rollback success
    if verify_health "$namespace" "$service"; then
        log_info "Rollback completed successfully for $service"
        return 0
    else
        log_error "Rollback failed for $service"
        return 1
    fi
}

cleanup_resources() {
    local namespace=$1

    log_info "Cleaning up resources in $namespace"

    # Remove failed deployments
    kubectl get deployments -n "$namespace" -o json | \
        jq -r '.items[] | select(.status.replicas == 0) | .metadata.name' | \
        xargs -r kubectl delete deployment -n "$namespace"
}

# Main execution
main() {
    if [ "$#" -lt 2 ]; then
        log_error "Usage: $0 <environment> <namespace> [version]"
        exit 1
    fi

    local environment=$1
    local namespace=$2
    local version=${3:-latest}

    # Set up error handling
    trap 'log_error "Deployment failed"; cleanup_resources "$namespace"' ERR

    # Execute deployment
    deploy_environment "$environment" "$namespace" "$version"
}

# Execute main function with provided arguments
main "$@"