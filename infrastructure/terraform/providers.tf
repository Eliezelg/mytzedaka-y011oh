# Terraform and Provider Versions Configuration
# Last Updated: 2023
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }
}

# Primary AWS Provider Configuration
provider "aws" {
  region = var.aws_primary_region

  # Default tags applied to all resources
  default_tags {
    tags = {
      Environment         = var.environment
      Project            = var.project_name
      ManagedBy          = "Terraform"
      SecurityCompliance = "PCI-DSS"
      DataClassification = "Sensitive"
      BackupPolicy       = "Daily"
      CostCenter         = "IJAP-Infrastructure"
    }
  }

  # Assume role configuration for secure deployment
  assume_role {
    role_arn     = var.terraform_role_arn
    session_name = "TerraformDeployment"
  }
}

# Secondary AWS Provider Configuration for Multi-Region Support
provider "aws" {
  alias  = "secondary"
  region = var.aws_secondary_region

  # Default tags applied to all resources in secondary region
  default_tags {
    tags = {
      Environment         = var.environment
      Project            = var.project_name
      ManagedBy          = "Terraform"
      SecurityCompliance = "PCI-DSS"
      DataClassification = "Sensitive"
      BackupPolicy       = "Daily"
      CostCenter         = "IJAP-Infrastructure"
    }
  }

  # Assume role configuration for secure deployment
  assume_role {
    role_arn     = var.terraform_role_arn
    session_name = "TerraformDeployment"
  }
}

# Random Provider Configuration for Secure Resource Naming
provider "random" {
  # No additional configuration needed
}

# Null Provider Configuration for Resource Dependencies
provider "null" {
  # No additional configuration needed
}