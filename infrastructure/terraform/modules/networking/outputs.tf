# VPC outputs
output "vpc_id" {
  description = "ID of the created VPC for resource association and security group configuration"
  value       = aws_vpc.main.id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC for network planning and security group rules"
  value       = aws_vpc.main.cidr_block
}

# Subnet outputs
output "public_subnet_ids" {
  description = "List of public subnet IDs for load balancers and NAT gateways across availability zones"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs for application containers and services with no direct internet access"
  value       = aws_subnet.private[*].id
}

output "database_subnet_ids" {
  description = "List of database subnet IDs for MongoDB and Redis clusters in isolated network segment"
  value       = aws_subnet.database[*].id
}

# Availability zone outputs
output "availability_zones" {
  description = "List of availability zones used for subnet distribution and high availability configuration"
  value       = var.availability_zones
}

# NAT Gateway outputs
output "nat_gateway_ids" {
  description = "List of NAT gateway IDs for private subnet internet access and route table configuration"
  value       = aws_nat_gateway.main[*].id
}

output "nat_public_ips" {
  description = "List of public IP addresses assigned to NAT gateways for security group egress rules"
  value       = aws_eip.nat[*].public_ip
}

# Network ACL outputs
output "public_nacl_id" {
  description = "ID of the network ACL protecting public subnets"
  value       = aws_network_acl.public.id
}

output "private_nacl_id" {
  description = "ID of the network ACL protecting private subnets"
  value       = aws_network_acl.private.id
}

output "database_nacl_id" {
  description = "ID of the network ACL protecting database subnets"
  value       = aws_network_acl.database.id
}

# Route table outputs
output "public_route_table_id" {
  description = "ID of the public route table for internet-facing resources"
  value       = aws_route_table.public.id
}

output "private_route_table_ids" {
  description = "List of private route table IDs for internal resources"
  value       = aws_route_table.private[*].id
}

output "database_route_table_id" {
  description = "ID of the database route table for isolated database resources"
  value       = aws_route_table.database.id
}

# Flow log outputs
output "vpc_flow_log_group" {
  description = "Name of the CloudWatch log group for VPC flow logs"
  value       = aws_cloudwatch_log_group.flow_log.name
}

output "vpc_flow_log_role_arn" {
  description = "ARN of the IAM role used for VPC flow logging"
  value       = aws_iam_role.flow_log.arn
}

# Network metadata outputs
output "network_details" {
  description = "Map of network details including CIDR blocks and subnet configurations"
  value = {
    vpc_cidr              = aws_vpc.main.cidr_block
    public_subnet_cidrs   = aws_subnet.public[*].cidr_block
    private_subnet_cidrs  = aws_subnet.private[*].cidr_block
    database_subnet_cidrs = aws_subnet.database[*].cidr_block
    dns_hostnames_enabled = aws_vpc.main.enable_dns_hostnames
  }
}