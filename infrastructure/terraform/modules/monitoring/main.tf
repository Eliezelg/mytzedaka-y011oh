# Provider configurations
provider "aws" {
  # AWS provider v4.0
}

provider "kubernetes" {
  # Kubernetes provider v2.0
}

provider "helm" {
  # Helm provider v2.0
}

# Data sources
data "aws_vpc" "main" {
  id = var.vpc_id
}

data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.main.id]
  }
  filter {
    name   = "tag:Type"
    values = ["Private"]
  }
}

# Monitoring namespace
resource "kubernetes_namespace" "monitoring" {
  metadata {
    name = var.monitoring_namespace
    labels = {
      name        = var.monitoring_namespace
      environment = var.environment
    }
  }
}

# Security Groups
resource "aws_security_group" "prometheus" {
  name_prefix = "prometheus-sg-"
  vpc_id      = data.aws_vpc.main.id

  ingress {
    from_port       = 9090
    to_port         = 9090
    protocol        = "tcp"
    security_groups = [aws_security_group.monitoring_internal.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "prometheus-sg"
    Environment = var.environment
  }
}

resource "aws_security_group" "grafana" {
  name_prefix = "grafana-sg-"
  vpc_id      = data.aws_vpc.main.id

  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.monitoring_internal.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "grafana-sg"
    Environment = var.environment
  }
}

# Prometheus deployment
resource "helm_release" "prometheus" {
  name       = "prometheus"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "prometheus"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name
  version    = "15.10.0"

  set {
    name  = "server.retention"
    value = "${var.prometheus_retention_days}d"
  }

  set {
    name  = "server.persistentVolume.size"
    value = "100Gi"
  }

  set {
    name  = "server.resources.requests.cpu"
    value = "1000m"
  }

  set {
    name  = "server.resources.requests.memory"
    value = "4Gi"
  }

  set {
    name  = "alertmanager.enabled"
    value = var.enable_alerting
  }

  dynamic "set" {
    for_each = var.high_availability_enabled ? [1] : []
    content {
      name  = "server.replicaCount"
      value = 3
    }
  }
}

# Grafana deployment
resource "helm_release" "grafana" {
  name       = "grafana"
  repository = "https://grafana.github.io/helm-charts"
  chart      = "grafana"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name
  version    = "6.32.0"

  values = [
    templatefile("${path.module}/templates/grafana-values.yaml", {
      admin_password = var.grafana_admin_password
      plugins        = var.grafana_plugins
    })
  ]

  set {
    name  = "persistence.enabled"
    value = true
  }

  set {
    name  = "persistence.size"
    value = "50Gi"
  }

  dynamic "set" {
    for_each = var.high_availability_enabled ? [1] : []
    content {
      name  = "replicas"
      value = 2
    }
  }
}

# ELK Stack deployment
resource "helm_release" "elasticsearch" {
  name       = "elasticsearch"
  repository = "https://helm.elastic.co"
  chart      = "elasticsearch"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name
  version    = "7.17.3"

  set {
    name  = "retention.days"
    value = var.elasticsearch_retention_days
  }

  set {
    name  = "volumeClaimTemplate.resources.requests.storage"
    value = "${var.elasticsearch_volume_size}Gi"
  }

  dynamic "set" {
    for_each = var.high_availability_enabled ? [1] : []
    content {
      name  = "replicas"
      value = 3
    }
  }
}

# Jaeger deployment
resource "helm_release" "jaeger" {
  name       = "jaeger"
  repository = "https://jaegertracing.github.io/helm-charts"
  chart      = "jaeger"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name
  version    = "0.71.0"

  set {
    name  = "retention.days"
    value = var.jaeger_retention_days
  }

  set {
    name  = "storage.type"
    value = "elasticsearch"
  }

  dynamic "set" {
    for_each = var.high_availability_enabled ? [1] : []
    content {
      name  = "collector.replicaCount"
      value = 2
    }
  }
}

# Outputs
output "prometheus_endpoints" {
  value = {
    primary_endpoint   = "${helm_release.prometheus.name}-server.${kubernetes_namespace.monitoring.metadata[0].name}.svc.cluster.local:9090"
    failover_endpoint = var.high_availability_enabled ? "${helm_release.prometheus.name}-server-1.${kubernetes_namespace.monitoring.metadata[0].name}.svc.cluster.local:9090" : null
  }
  description = "Prometheus server endpoints"
}

output "grafana_endpoints" {
  value = {
    primary_endpoint   = "${helm_release.grafana.name}.${kubernetes_namespace.monitoring.metadata[0].name}.svc.cluster.local:3000"
    failover_endpoint = var.high_availability_enabled ? "${helm_release.grafana.name}-1.${kubernetes_namespace.monitoring.metadata[0].name}.svc.cluster.local:3000" : null
  }
  description = "Grafana dashboard endpoints"
}

output "monitoring_security_groups" {
  value = {
    prometheus_sg_id    = aws_security_group.prometheus.id
    grafana_sg_id       = aws_security_group.grafana.id
    elasticsearch_sg_id = aws_security_group.elasticsearch.id
  }
  description = "Security group IDs for monitoring components"
}