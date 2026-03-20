# dev_seats was created manually — not managed by Terraform
# data source used only to reference its ARN in IAM policies
data "aws_dynamodb_table" "seats" {
  name = "${var.env}_seats"
}

# ── Payment tasks table ───────────────────────────────────────────────────────

resource "aws_dynamodb_table" "payment_tasks" {
  name         = "${var.env}_payment_tasks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "razorpay_order_id"

  attribute {
    name = "razorpay_order_id"
    type = "S"
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }
}
