# ── DynamoDB: Stream State ─────────────────────────────────────────────────────

resource "aws_dynamodb_table" "stream_state" {
  name         = "${var.env}_stream_state"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "event_id"

  attribute {
    name = "event_id"
    type = "S"
  }
}

# ── DynamoDB: Chat Messages ───────────────────────────────────────────────────

resource "aws_dynamodb_table" "chat_messages" {
  name         = "${var.env}_chat_messages"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "event_id"
  range_key    = "ts_id"

  attribute {
    name = "event_id"
    type = "S"
  }

  attribute {
    name = "ts_id"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }
}

# ── Outputs ────────────────────────────────────────────────────────────────────

output "stream_state_table_name" {
  description = "Name of the DynamoDB stream state table"
  value       = aws_dynamodb_table.stream_state.name
}

output "chat_messages_table_name" {
  description = "Name of the DynamoDB chat messages table"
  value       = aws_dynamodb_table.chat_messages.name
}
