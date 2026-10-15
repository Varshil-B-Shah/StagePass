# ── Seats table ───────────────────────────────────────────────────────────────
# PK: show_id (event_id#date#time), SK: seat_id. Holds are claimed with
# conditional writes on `status` — see booking-service seat.repository.ts.

resource "aws_dynamodb_table" "seats" {
  name         = "${var.env}_seats"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "show_id"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "held_by"
    type = "S"
  }

  attribute {
    name = "hold_expires_at"
    type = "N"
  }

  global_secondary_index {
    name            = "show_id-status-index"
    hash_key        = "show_id"
    range_key       = "status"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "held_by-expires_at-index"
    hash_key        = "held_by"
    range_key       = "hold_expires_at"
    projection_type = "ALL"
  }

  # Fallback cleanup only — Redis TTL drives hold expiry; DynamoDB TTL can lag days
  ttl {
    attribute_name = "hold_expires_at_ttl"
    enabled        = true
  }
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
