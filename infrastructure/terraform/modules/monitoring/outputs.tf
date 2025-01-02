# Output configuration for monitoring infrastructure endpoints and metadata
# Terraform version: >= 1.0.0
# Provider requirements: AWS ~> 4.0, Kubernetes ~> 2.0, Helm ~> 2.0

# Prometheus monitoring endpoints for metrics collection
output "prometheus_endpoints" {
  description = "Primary and failover Prometheus server endpoints for metrics collection"
  value = {
    primary  = "${prometheus_deployment.primary.endpoint}:9090"
    failover = prometheus_failover_deployment.secondary.endpoint != null ? "${prometheus_failover_deployment.secondary.endpoint}:9090" : null
  }
  sensitive = false
}

# Grafana visualization endpoints for dashboard access
output "grafana_endpoints" {
  description = "Primary and failover Grafana dashboard access endpoints"
  value = {
    primary  = "${grafana_deployment.primary.endpoint}:3000"
    failover = grafana_failover_deployment.secondary.endpoint != null ? "${grafana_failover_deployment.secondary.endpoint}:3000" : null
  }
  sensitive = false
}

# Elasticsearch logging endpoints for log aggregation
output "elasticsearch_endpoints" {
  description = "Primary and failover Elasticsearch endpoints for log access"
  value = {
    primary  = "${elasticsearch_deployment.primary.endpoint}:9200"
    failover = elasticsearch_failover_deployment.secondary.endpoint != null ? "${elasticsearch_failover_deployment.secondary.endpoint}:9200" : null
  }
  sensitive = false
}

# Jaeger tracing endpoints for distributed tracing
output "jaeger_endpoints" {
  description = "Primary and failover Jaeger endpoints for distributed tracing"
  value = {
    primary  = "${jaeger_deployment.primary.endpoint}:16686"
    failover = jaeger_failover_deployment.secondary.endpoint != null ? "${jaeger_failover_deployment.secondary.endpoint}:16686" : null
  }
  sensitive = false
}

# Security group IDs for monitoring components
output "monitoring_security_groups" {
  description = "Security group IDs for each monitoring component"
  value = {
    prometheus_sg_id    = prometheus_deployment.primary.security_group_id
    grafana_sg_id      = grafana_deployment.primary.security_group_id
    elasticsearch_sg_id = elasticsearch_deployment.primary.security_group_id
    jaeger_sg_id       = jaeger_deployment.primary.security_group_id
  }
  sensitive = false
}

# Monitoring infrastructure metadata
output "monitoring_metadata" {
  description = "Metadata about monitoring infrastructure deployment"
  value = {
    namespace     = kubernetes_namespace.monitoring.metadata[0].name
    region        = data.aws_region.current.name
    cluster_name  = data.aws_eks_cluster.monitoring.name
  }
  sensitive = false
}

# AlertManager endpoints for alert management
output "alertmanager_endpoints" {
  description = "Primary and failover AlertManager endpoints for alert management"
  value = {
    primary  = "${alertmanager_deployment.primary.endpoint}:9093"
    failover = alertmanager_deployment.failover != null ? "${alertmanager_deployment.failover.endpoint}:9093" : null
  }
  sensitive = false
}