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

data "archive_file" "refund_payment" {
  type        = "zip"
  source_dir  = "${path.module}/../lambdas/refund-payment"
  output_path = "${path.module}/../lambdas/refund-payment.zip"
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
      TABLE_PREFIX    = "${var.env}_"
      WS_INTERNAL_URL = var.ws_internal_url
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

resource "aws_lambda_function" "refund_payment" {
  function_name    = "stagepass-refund-payment-${var.env}"
  role             = aws_iam_role.lambda.arn
  filename         = data.archive_file.refund_payment.output_path
  source_code_hash = data.archive_file.refund_payment.output_base64sha256
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 30

  environment {
    variables = {
      PAYMENT_SERVICE_URL = var.payment_service_url
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
            # ResultPath keeps booking_id and show_id in the payload — without it
            # the error object replaces the input and compensation has nothing to act on.
            ResultPath = "$.error"
            Next       = "RefundPayment"
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
      # Money back before the seat goes back. A no-op when nothing was captured,
      # which is the ordinary case when a hold simply times out.
      RefundPayment = {
        Type       = "Task"
        Resource   = aws_lambda_function.refund_payment.arn
        ResultPath = "$.refund"
        Retry = [
          {
            ErrorEquals     = ["States.ALL"]
            IntervalSeconds = 2
            MaxAttempts     = 3
            BackoffRate     = 2
          }
        ]
        Catch = [
          {
            ErrorEquals = ["States.ALL"]
            ResultPath  = "$.refundError"
            # A failed refund must not strand the seat — release it and alarm on the log.
            Next = "ExpireHold"
          }
        ]
        Next = "ExpireHold"
      }
      ExpireHold = {
        Type     = "Task"
        Resource = aws_lambda_function.expire_hold.arn
        End      = true
      }
    }
  })
}
