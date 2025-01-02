# Output definitions for security module resources
# These outputs expose critical security resource identifiers for use in other modules

output "waf_web_acl_arn" {
  description = "ARN of the WAF web ACL for association with application load balancer to implement web application firewall rules"
  value       = aws_wafv2_web_acl.main.arn
}

output "alb_security_group_id" {
  description = "ID of the security group for application load balancer to control inbound/outbound traffic"
  value       = aws_security_group.alb.id
}

output "ecs_security_group_id" {
  description = "ID of the security group for ECS tasks to manage container-level network access"
  value       = aws_security_group.ecs_tasks.id
}

output "kms_key_arn" {
  description = "ARN of the KMS key for encrypting sensitive data across services and storage"
  value       = aws_kms_key.main.arn
}

output "ecs_task_role_arn" {
  description = "ARN of the IAM role for ECS tasks to grant necessary AWS service permissions"
  value       = aws_iam_role.ecs_task_role.arn
}