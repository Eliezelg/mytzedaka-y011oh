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

  backend "s3" {
    bucket         = "ijap-terraform-state"
    key            = "infrastructure/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "ijap-terraform-locks"
  }
}

# Configure AWS Provider with enhanced security tags
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment         = var.environment
      Project            = "IJAP"
      ManagedBy         = "Terraform"
      SecurityCompliance = "PCI-DSS-L1"
      DataClassification = "Sensitive"
      CostCenter        = "donation-platform"
    }
  }
}

# Networking module for multi-AZ infrastructure
module "networking" {
  source = "./modules/networking"

  environment          = var.environment
  vpc_cidr            = var.vpc_cidr
  availability_zones  = var.availability_zones
  enable_flow_logs    = true
  enable_vpc_endpoints = true
  network_acls_enabled = true
  
  public_subnet_cidrs   = var.public_subnet_cidrs
  private_subnet_cidrs  = var.private_subnet_cidrs
  database_subnet_cidrs = var.database_subnet_cidrs

  tags = {
    SecurityZone = "network-perimeter"
    Compliance   = "pci-dss-network"
  }
}

# Compute module for containerized services
module "compute" {
  source = "./modules/compute"

  environment         = var.environment
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  
  container_insights   = true
  enhanced_monitoring = true
  auto_scaling_enabled = true
  capacity_providers  = ["FARGATE", "FARGATE_SPOT"]

  min_capacity = var.environment == "prod" ? 2 : 1
  max_capacity = var.environment == "prod" ? 10 : 4

  tags = {
    SecurityZone = "application-tier"
    Compliance   = "pci-dss-compute"
  }
}

# Database module for data persistence
module "database" {
  source = "./modules/database"

  environment          = var.environment
  vpc_id              = module.networking.vpc_id
  database_subnet_ids = module.networking.database_subnet_ids
  
  mongodb_instance_type = var.mongodb_instance_type
  redis_node_type      = var.redis_node_type
  
  encryption_at_rest          = true
  backup_retention_period     = 30
  performance_insights_enabled = true
  enhanced_monitoring_enabled = true
  multi_az                    = var.environment == "prod" ? true : false

  tags = {
    SecurityZone = "data-tier"
    Compliance   = "pci-dss-database"
  }
}

# Security module for compliance and protection
module "security" {
  source = "./modules/security"

  environment  = var.environment
  vpc_id      = module.networking.vpc_id
  domain_name = var.domain_name

  enable_waf          = true
  enable_guard_duty   = true
  enable_security_hub = true
  enable_config       = true
  pci_dss_enabled     = true
  enhanced_logging    = true
  
  ssl_policy = "ELBSecurityPolicy-TLS-1-2-Ext-2018-06"

  waf_rules = {
    rate_limit = 2000
    ip_rate_limit = 500
    geo_match = ["IL", "US", "FR"] # Israel, US, France per requirements
  }

  tags = {
    SecurityZone = "security-controls"
    Compliance   = "pci-dss-security"
  }
}

# Outputs for cross-module references
output "vpc_id" {
  description = "ID of the created VPC with enhanced security features"
  value       = module.networking.vpc_id
}

output "ecs_cluster_id" {
  description = "ID of the high-availability ECS cluster"
  value       = module.compute.ecs_cluster_id
}

output "database_endpoints" {
  description = "Endpoints for database connections"
  value = {
    mongodb = module.database.mongodb_endpoint
    redis   = module.database.redis_endpoint
  }
  sensitive = true
}

output "security_groups" {
  description = "Security group IDs for different tiers"
  value = {
    alb     = module.compute.alb_security_group_id
    ecs     = module.compute.ecs_security_group_id
    database = module.database.database_security_group_id
  }
}