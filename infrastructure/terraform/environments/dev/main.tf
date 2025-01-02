# Configure Terraform settings and required providers
terraform {
  required_version = ">= 1.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws" # v5.0
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "ijap-terraform-state-dev"
    key            = "dev/terraform.tfstate"
    region         = "il-central-1" # Israel region for development
    encrypt        = true
    dynamodb_table = "ijap-terraform-locks-dev"
  }
}

# Configure AWS Provider with development-specific tags
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment         = "dev"
      Project            = "IJAP"
      ManagedBy          = "Terraform"
      CostCenter         = "Development"
      SecurityCompliance = "Development"
      DataClassification = "Development"
    }
  }
}

# Root module configuration with development-specific settings
module "root" {
  source = "../../"

  # Environment configuration
  environment = "dev"
  aws_region  = var.aws_region

  # Network configuration
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones

  # Database configuration - development sizing
  mongodb_instance_type = var.mongodb_instance_type # e.g. "db.t3.medium"
  redis_node_type      = var.redis_node_type       # e.g. "cache.t3.micro"

  # Monitoring configuration - development appropriate
  container_insights        = var.container_insights        # Enabled for development debugging
  monitoring_retention_days = var.monitoring_retention_days # Shorter retention for dev
  enable_waf               = var.enable_waf                # Basic WAF rules for dev

  # Development-specific optimizations
  enable_spot_instances     = true  # Use spot instances for cost savings
  development_access       = true  # Allow broader access for development
  reduced_monitoring      = true  # Reduced monitoring for cost savings
  cost_optimization_enabled = true # Enable cost optimization features

  # Override production defaults for development environment
  single_nat_gateway = true # Use single NAT gateway for cost savings
  multi_az          = false # Single AZ deployment for development
  backup_retention_period = 7 # Reduced backup retention for development
}

# Development environment outputs
output "vpc_id" {
  description = "The ID of the development VPC"
  value       = module.root.vpc_id
}

output "ecs_cluster_arn" {
  description = "The ARN of the development ECS cluster"
  value       = module.root.ecs_cluster_arn
}