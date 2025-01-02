# Provider version constraint
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# WAF Web ACL with comprehensive rule sets
resource "aws_wafv2_web_acl" "main" {
  name        = "ijap-${var.environment}-waf"
  description = "WAF ACL for IJAP ${var.environment} environment"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  # Rate-based rule for DDoS protection
  rule {
    name     = "RateBasedRule"
    priority = 1

    override_action {
      none {}
    }

    statement {
      rate_based_statement {
        limit              = var.waf_configuration.ip_rate_based_rule.limit
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "RateBasedRule"
      sampled_requests_enabled  = true
    }
  }

  # SQL Injection protection
  rule {
    name     = "SQLInjectionProtection"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "SQLInjectionProtection"
      sampled_requests_enabled  = true
    }
  }

  # XSS protection
  rule {
    name     = "XSSProtection"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "XSSProtection"
      sampled_requests_enabled  = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name               = "IJAPWAF"
    sampled_requests_enabled  = true
  }

  tags = {
    Environment = var.environment
    Name        = "ijap-${var.environment}-waf"
  }
}

# ALB Security Group
resource "aws_security_group" "alb" {
  name        = "ijap-${var.environment}-alb-sg"
  description = "Security group for application load balancer"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP from internet (redirect to HTTPS)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "ijap-${var.environment}-alb-sg"
    Environment = var.environment
  }
}

# ECS Tasks Security Group
resource "aws_security_group" "ecs_tasks" {
  name        = "ijap-${var.environment}-ecs-tasks-sg"
  description = "Security group for ECS tasks"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Allow inbound traffic from ALB"
    from_port       = 0
    to_port         = 0
    protocol        = "-1"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "ijap-${var.environment}-ecs-tasks-sg"
    Environment = var.environment
  }
}

# KMS Key for encryption
resource "aws_kms_key" "main" {
  description             = "IJAP ${var.environment} encryption key"
  deletion_window_in_days = var.kms_configuration.deletion_window_days
  enable_key_rotation     = var.kms_configuration.enable_key_rotation
  key_usage              = var.kms_configuration.key_usage
  customer_master_key_spec = var.kms_configuration.customer_master_key_spec

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow ECS to use the key"
        Effect = "Allow"
        Principal = {
          Service = "ecs.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Environment = var.environment
    Name        = "ijap-${var.environment}-kms"
  }
}

# Shield Advanced protection
resource "aws_shield_protection" "resources" {
  count        = var.ddos_protection.enable_shield ? 1 : 0
  name         = "ijap-${var.environment}-shield"
  resource_arn = aws_lb.main.arn

  tags = {
    Environment = var.environment
    Name        = "ijap-${var.environment}-shield"
  }
}

# ECS Task Role
resource "aws_iam_role" "ecs_task_role" {
  name = "ijap-${var.environment}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  permissions_boundary = var.iam_boundary_policy

  tags = {
    Environment = var.environment
    Name        = "ijap-${var.environment}-ecs-task-role"
  }
}

# Data source for current AWS account
data "aws_caller_identity" "current" {}

# Outputs
output "waf_web_acl_arn" {
  description = "ARN of the WAF Web ACL"
  value       = aws_wafv2_web_acl.main.arn
}

output "kms_key_arn" {
  description = "ARN of the KMS key"
  value       = aws_kms_key.main.arn
}

output "security_group_ids" {
  description = "Map of security group IDs"
  value = {
    alb       = aws_security_group.alb.id
    ecs_tasks = aws_security_group.ecs_tasks.id
  }
}