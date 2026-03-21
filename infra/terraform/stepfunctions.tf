# ── Lambda functions ──────────────────────────────────────────────────────────

data "archive_file" "confirm_booking" {
  type        = "zip"
  source_dir  = "${path.module}/../lambdas/confirm-booking"
  output_path = "${path.module}/../lambdas/confirm-booking.zip"
}

data "archive_file" "send_email" {
  type        = "zip"
  source_dir  = "${path.module}/../lambdas/send-email"
  output_path = "${path.module}/../lambdas/send-email.zip"
}

data "archive_file" "expire_hold" {
  type        = "zip"
  source_dir  = "${path.module}/../lambdas/expire-hold"
  output_path = "${path.module}/../lambdas/expire-hold.zip"
}

resource "aws_lambda_function" "confirm_booking" {
  function_name    = "stagepass-confirm-booking-${var.env}"
  role             = aws_iam_role.lambda.arn
  filename         = data.archive_file.confirm_booking.output_path
  source_code_hash = data.archive_file.confirm_booking.output_base64sha256
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 30

  environment {
    variables = {
      TABLE_PREFIX     = "${var.env}_"
      WS_INTERNAL_URL  = var.ws_internal_url
    }
  }
}

resource "aws_lambda_function" "send_email" {
  function_name    = "stagepass-send-email-${var.env}"
  role             = aws_iam_role.lambda.arn
  filename         = data.archive_file.send_email.output_path
  source_code_hash = data.archive_file.send_email.output_base64sha256
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 30

  environment {
    variables = {
      TABLE_PREFIX        = "${var.env}_"
      BOOKING_SERVICE_URL = var.booking_service_url
      INTERNAL_API_SECRET = var.internal_api_secret
      SES_FROM_EMAIL      = var.ses_from_email
    }
  }
}

resource "aws_lambda_function" "expire_hold" {
  function_name    = "stagepass-expire-hold-${var.env}"
  role             = aws_iam_role.lambda.arn
  filename         = data.archive_file.expire_hold.output_path
  source_code_hash = data.archive_file.expire_hold.output_base64sha256
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 30

  environment {
    variables = {
      TABLE_PREFIX        = "${var.env}_"
      BOOKING_SERVICE_URL = var.booking_service_url
      INTERNAL_API_SECRET = var.internal_api_secret
    }
  }
}

# ── Step Functions state machine ──────────────────────────────────────────────

resource "aws_sfn_state_machine" "payment" {
  name     = "stagepass-payment-${var.env}"
  role_arn = aws_iam_role.step_functions.arn

  definition = jsonencode({
    Comment = "StagePass payment fulfillment — wait-for-callback pattern"
    StartAt = "WaitForPayment"
    States = {
      WaitForPayment = {
        Type           = "Task"
        Resource       = "arn:aws:states:::lambda:invoke.waitForTaskToken"
        TimeoutSeconds = 900
        Parameters = {
          FunctionName = aws_lambda_function.confirm_booking.arn
          Payload = {
            "taskToken.$" = "$$.Task.Token"
            "input.$"     = "$$"
          }
        }
        Catch = [
          {
            ErrorEquals = ["States.ALL"]
            Next        = "ExpireHold"
          }
        ]
        Next = "SendEmail"
      }
      SendEmail = {
        Type     = "Task"
        Resource = aws_lambda_function.send_email.arn
        Catch = [
          {
            ErrorEquals = ["States.ALL"]
            ResultPath  = "$.emailError"
            Next        = "BookingConfirmed"
          }
        ]
        Next = "BookingConfirmed"
      }
      BookingConfirmed = {
        Type = "Succeed"
      }
      ExpireHold = {
        Type     = "Task"
        Resource = aws_lambda_function.expire_hold.arn
        End      = true
      }
    }
  })
}
