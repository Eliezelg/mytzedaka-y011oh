variable "environment" {
  type        = string
  description = "Environment name (dev/staging/prod) for resource tagging and environment-specific configurations"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the VPC with validation for proper network range"
  default     = "10.0.0.0/16"
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR block must be a valid IPv4 CIDR notation."
  }
}

variable "availability_zones" {
  type        = list(string)
  description = "List of availability zones for multi-AZ deployment with validation for minimum count"
  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least 2 availability zones must be specified for high availability."
  }
}

variable "public_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for public subnets hosting load balancers and NAT gateways"
  validation {
    condition     = length(var.public_subnet_cidrs) >= 2
    error_message = "At least 2 public subnet CIDR blocks must be specified for high availability."
  }
}

variable "private_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for private subnets hosting application containers and services"
  validation {
    condition     = length(var.private_subnet_cidrs) >= 2
    error_message = "At least 2 private subnet CIDR blocks must be specified for high availability."
  }
}

variable "database_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for database subnets hosting MongoDB and Redis clusters"
  validation {
    condition     = length(var.database_subnet_cidrs) >= 2
    error_message = "At least 2 database subnet CIDR blocks must be specified for high availability."
  }
}

variable "enable_nat_gateway" {
  type        = bool
  description = "Flag to enable NAT gateways for private subnet internet access with cost consideration"
  default     = true
}

variable "single_nat_gateway" {
  type        = bool
  description = "Flag to use single NAT gateway for cost optimization in non-production environments"
  default     = false
}

variable "enable_dns_hostnames" {
  type        = bool
  description = "Flag to enable DNS hostnames in the VPC for service discovery"
  default     = true
}

variable "enable_dns_support" {
  type        = bool
  description = "Flag to enable DNS support in the VPC for internal DNS resolution"
  default     = true
}

variable "tags" {
  type        = map(string)
  description = "Resource tags for cost allocation and resource management"
  default = {
    Terraform   = "true"
    Application = "jewish-donation-platform"
  }
}