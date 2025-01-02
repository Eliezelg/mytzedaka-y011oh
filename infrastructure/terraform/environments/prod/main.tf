# Configure Terraform settings and required providers
terraform {
  required_version = ">= 1.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws" # v5.0
      version = "~> 5.0"
    }
  }

  # Production state backend configuration
  backend "s3" {
    bucket         = "ijap-terraform-prod-state"
    key            = "prod/terraform.tfstate"
    region         = "eu-central-1"
    encrypt        = true
    dynamodb_table = "ijap-terraform-prod-locks"
  }
}

# Define local variables for production environment
locals {
  environment = "prod"
  common_tags = {
    Environment        = "production"
    Project           = "IJAP"
    ManagedBy         = "Terraform"
    ComplianceLevel   = "PCI-DSS-L1"
    DataClassification = "Sensitive"
    BackupFrequency   = "Daily"
    SecurityZone      = "Production"
  }
}

# Configure AWS Provider with production settings
provider "aws" {
  region = "eu-central-1"
  default_tags = local.common_tags
}

# Production Networking Module
module "networking" {
  source = "../../modules/networking"

  environment = local.environment
  vpc_cidr    = "10.0.0.0/16"
  availability_zones = [
    "eu-central-1a",
    "eu-central-1b",
    "eu-central-1c"
  ]
  enable_nat_gateway    = true
  single_nat_gateway    = false
  enable_vpn_gateway    = true
  enable_flow_logs      = true
  flow_logs_retention_days = 365
  network_acls_enabled  = true
  transit_gateway_enabled = true
  
  tags = local.common_tags
}

# Production Compute Module
module "compute" {
  source = "../../modules/compute"

  environment = local.environment
  vpc_id      = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  
  container_insights = true
  api_min_capacity  = 3
  api_max_capacity  = 10
  web_min_capacity  = 3
  web_max_capacity  = 10
  
  enable_detailed_monitoring = true
  cpu_utilization_threshold = 70
  memory_utilization_threshold = 80
  auto_scaling_cooldown = 300
  
  tags = local.common_tags
}

# Production Database Module
module "database" {
  source = "../../modules/database"

  environment = local.environment
  vpc_id      = module.networking.vpc_id
  database_subnet_ids = module.networking.database_subnet_ids
  
  mongodb_instance_type = "M30"
  mongodb_backup_retention_days = 7
  mongodb_encryption_at_rest = true
  mongodb_audit_logging = true
  
  redis_node_type = "cache.r6g.xlarge"
  redis_num_cache_nodes = 3
  redis_snapshot_retention_limit = 7
  redis_encryption_at_rest = true
  redis_auth_token_enabled = true
  
  tags = local.common_tags
}

# Production Security Module
module "security" {
  source = "../../modules/security"

  environment = local.environment
  vpc_id      = module.networking.vpc_id
  domain_name = "ijap.org"
  
  enable_waf = true
  enable_shield = true
  enable_guardduty = true
  enable_security_hub = true
  enable_config = true
  enable_cloudtrail = true
  
  ssl_certificate_type = "acm"
  waf_rule_groups = [
    "AWS-AWSManagedRulesCommonRuleSet",
    "AWS-AWSManagedRulesKnownBadInputsRuleSet"
  ]
  
  tags = local.common_tags
}

# Production environment outputs
output "vpc_id" {
  description = "Production VPC ID"
  value       = module.networking.vpc_id
}

output "private_subnet_ids" {
  description = "Production private subnet IDs"
  value       = module.networking.private_subnet_ids
}

output "database_subnet_ids" {
  description = "Production database subnet IDs"
  value       = module.networking.database_subnet_ids
}

output "mongodb_endpoint" {
  description = "Production MongoDB endpoint"
  value       = module.database.mongodb_endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "Production Redis endpoint"
  value       = module.database.redis_endpoint
  sensitive   = true
}