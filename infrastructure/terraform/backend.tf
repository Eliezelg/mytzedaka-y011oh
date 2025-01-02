# Backend configuration for International Jewish Association Donation Platform
# Version: 1.0.0
# Last Updated: 2023
# This configuration establishes a secure, highly available state management system
# using AWS S3 for state storage and DynamoDB for state locking

terraform {
  backend "s3" {
    # Primary state storage bucket with environment-based workspace isolation
    bucket = "ijap-terraform-state"
    key    = "terraform.tfstate"
    region = var.aws_region

    # Enable encryption at rest using AWS KMS
    encrypt = true
    
    # State locking using DynamoDB
    dynamodb_table = "ijap-terraform-locks"
    
    # Environment-based workspace isolation
    workspace_key_prefix = var.environment

    # Enable versioning for state history and recovery
    versioning = true

    # Server-side encryption configuration using AWS KMS
    server_side_encryption_configuration {
      rule {
        apply_server_side_encryption_by_default {
          sse_algorithm = "aws:kms"
        }
      }
    }

    # Access logging configuration for audit and compliance
    logging {
      target_bucket = "ijap-terraform-logs"
      target_prefix = "state-access-logs/"
    }

    # Force SSL/TLS for all state access
    force_ssl = true

    # Enable cross-region replication for disaster recovery
    replication_configuration {
      role = "arn:aws:iam::ACCOUNT_ID:role/terraform-state-replication-role"
      rules {
        id     = "state-replication"
        status = "Enabled"
        destination {
          bucket = "arn:aws:s3:::ijap-terraform-state-replica"
          encryption_configuration {
            replica_kms_key_id = "arn:aws:kms:REGION:ACCOUNT_ID:key/REPLICA_KEY_ID"
          }
        }
      }
    }

    # Lifecycle rules for state management
    lifecycle_rule {
      id      = "state-lifecycle"
      enabled = true

      noncurrent_version_expiration {
        days = 90
      }

      noncurrent_version_transition {
        days          = 30
        storage_class = "STANDARD_IA"
      }
    }

    # Object lock configuration for critical states
    object_lock_configuration {
      object_lock_enabled = "Enabled"
      rule {
        default_retention {
          mode = "GOVERNANCE"
          days = 14
        }
      }
    }
  }
}

# Additional backend configuration for DynamoDB state locking
resource "aws_dynamodb_table" "terraform_locks" {
  name         = "ijap-terraform-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  # Enable point-in-time recovery for the locks table
  point_in_time_recovery {
    enabled = true
  }

  # Enable server-side encryption
  server_side_encryption {
    enabled = true
  }

  # Tags for resource tracking
  tags = {
    Name        = "Terraform State Lock Table"
    Environment = var.environment
    Project     = "International Jewish Association Donation Platform"
    ManagedBy   = "Terraform"
  }

  # Enable auto-scaling for the DynamoDB table
  replica {
    region_name = "eu-west-1" # Secondary region for high availability
  }
}

# KMS key for state encryption
resource "aws_kms_key" "terraform_state" {
  description             = "KMS key for Terraform state encryption"
  deletion_window_in_days = 30
  enable_key_rotation    = true

  tags = {
    Name        = "terraform-state-encryption-key"
    Environment = var.environment
    Project     = "International Jewish Association Donation Platform"
    ManagedBy   = "Terraform"
  }
}

# KMS key alias
resource "aws_kms_alias" "terraform_state" {
  name          = "alias/terraform-state-key"
  target_key_id = aws_kms_key.terraform_state.key_id
}