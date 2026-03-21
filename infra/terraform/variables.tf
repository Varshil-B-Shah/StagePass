variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "aws_access_key_id" {
  description = "AWS access key ID"
  type        = string
  sensitive   = true
}

variable "aws_secret_access_key" {
  description = "AWS secret access key"
  type        = string
  sensitive   = true
}

variable "env" {
  description = "Environment prefix (dev or prod)"
  type        = string
  default     = "dev"
}

variable "ses_from_email" {
  description = "Email address to send from via SES"
  type        = string
  default     = "varshilshah.work@gmail.com"
}

variable "ws_internal_url" {
  description = "Internal HTTP URL of the WebSocket server (for Lambda → WS broadcast)"
  type        = string
  default     = "http://localhost:4001"
}

variable "booking_service_url" {
  description = "Internal HTTP URL of the booking service"
  type        = string
  default     = "http://localhost:3001"
}

variable "internal_api_secret" {
  description = "Shared secret for internal service-to-service calls"
  type        = string
  sensitive   = true
  default     = ""
}
