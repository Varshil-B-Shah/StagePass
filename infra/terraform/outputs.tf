output "cognito_user_pool_id" {
  description = "Cognito User Pool ID → COGNITO_USER_POOL_ID in .env"
  value       = aws_cognito_user_pool.main.id
}

output "cognito_client_id" {
  description = "Cognito App Client ID → COGNITO_CLIENT_ID in .env"
  value       = aws_cognito_user_pool_client.main.id
}

output "step_functions_arn" {
  description = "Step Functions state machine ARN → STEP_FUNCTIONS_STATE_MACHINE_ARN in .env"
  value       = aws_sfn_state_machine.payment.arn
}

output "ses_identity_arn" {
  description = "SES email identity ARN"
  value       = aws_ses_email_identity.from.arn
}
