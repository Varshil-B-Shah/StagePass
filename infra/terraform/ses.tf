resource "aws_ses_email_identity" "from" {
  email = var.ses_from_email
}
