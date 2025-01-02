# Configure Terraform settings and required providers
terraform {
  required_version = ">= 1.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws" # v5.0
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random" # v3.0
      version = "~> 3.0"
    }
  }

  # S3 backend configuration for state management
  backend "s3" {
    bucket         = "ijap-terraform-state-staging"
    key            = "staging/terraform.tfstate"
    region         = "${var.aws_region}"
    encrypt        = true
    dynamodb_table = "ijap-terraform-locks-staging"
    kms_key_id     = "${var.kms_key_id}"
    versioning     = true
    server_side_encryption = "aws:kms"
  }
}

# Configure AWS Provider with staging-specific tags
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment        = "staging"
      Project           = "IJAP"
      ManagedBy        = "Terraform"
      SecurityLevel    = "high"
      DataClassification = "sensitive"
    }
  }
}

# Root module configuration for staging environment
module "root_module" {
  source = "../../"

  # Environment configuration
  environment = "staging"
  aws_region  = var.aws_region
  vpc_cidr    = var.vpc_cidr
  availability_zones = var.availability_zones

  # Container configuration
  container_insights = true
  ecs_task_cpu      = 256
  ecs_task_memory   = 512
  min_capacity      = 1
  max_capacity      = 4
  enable_spot_instances = true

  # Database configuration
  mongodb_instance_type = "db.t3.medium"
  redis_node_type      = "cache.t3.medium"
  backup_retention_period = 7
  enable_performance_insights = true
  enable_enhanced_monitoring = true
  enable_auto_scaling       = true

  # Domain configuration
  domain_name = var.domain_name

  # Security configuration
  enable_waf = true
  security_config = {
    enable_waf          = true
    enable_guard_duty   = true
    enable_security_hub = true
    enable_config       = true
  }

  # Monitoring configuration
  monitoring_retention_days = 30
  logging_config = {
    retention_days = 30
    enable_audit_logs = true
    enable_performance_logs = true
  }

  # Payment gateway configuration for staging
  sandbox_mode = true
  payment_gateway_config = {
    stripe_sandbox = true
    tranzilla_sandbox = true
  }
}

# Outputs for staging environment
output "vpc_id" {
  description = "ID of the staging VPC"
  value       = module.root_module.vpc_id
}

output "ecs_cluster_id" {
  description = "ID of the staging ECS cluster"
  value       = module.root_module.ecs_cluster_id
}

output "database_endpoints" {
  description = "Database endpoints for staging environment"
  value       = module.root_module.database_endpoints
  sensitive   = true
}

output "alb_dns_name" {
  description = "DNS name of the staging Application Load Balancer"
  value       = module.root_module.alb_dns_name
}

output "cloudfront_distribution_id" {
  description = "ID of the staging CloudFront distribution"
  value       = module.root_module.cloudfront_distribution_id
}

output "monitoring_dashboard_url" {
  description = "URL of the staging monitoring dashboard"
  value       = module.root_module.monitoring_dashboard_url
}