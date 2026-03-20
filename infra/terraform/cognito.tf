resource "aws_cognito_user_pool" "main" {
  name = "stagepass-${var.env}"

  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = false
  }

  schema {
    attribute_data_type = "String"
    name                = "email"
    required            = true
    mutable             = true
  }

  schema {
    attribute_data_type = "String"
    name                = "name"
    required            = false
    mutable             = true
  }
}

resource "aws_cognito_user_pool_client" "main" {
  name         = "stagepass-${var.env}-client"
  user_pool_id = aws_cognito_user_pool.main.id

  # No client secret — BFF pattern, server-side only
  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  # Tokens valid for: access=1h, id=1h, refresh=30d
  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 30

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }
}
