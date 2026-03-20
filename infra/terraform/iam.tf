# ── Step Functions execution role ─────────────────────────────────────────────

resource "aws_iam_role" "step_functions" {
  name = "stagepass-step-functions-${var.env}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "states.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      },
    ]
  })
}

resource "aws_iam_role_policy" "step_functions_lambda" {
  name = "invoke-lambdas"
  role = aws_iam_role.step_functions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "lambda:InvokeFunction"
        Resource = [
          aws_lambda_function.confirm_booking.arn,
          aws_lambda_function.send_email.arn,
          aws_lambda_function.expire_hold.arn,
        ]
      },
    ]
  })
}

# ── Lambda execution role (shared by all 3 Lambdas) ──────────────────────────

resource "aws_iam_role" "lambda" {
  name = "stagepass-lambda-${var.env}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_permissions" {
  name = "stagepass-lambda-permissions-${var.env}"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DynamoSeats"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
        ]
        Resource = data.aws_dynamodb_table.seats.arn
      },
      {
        Sid    = "DynamoPaymentTasks"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:DeleteItem",
        ]
        Resource = aws_dynamodb_table.payment_tasks.arn
      },
      {
        Sid      = "SES"
        Effect   = "Allow"
        Action   = "ses:SendEmail"
        Resource = "*"
      },
    ]
  })
}
