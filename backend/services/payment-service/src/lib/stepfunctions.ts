import AWS from 'aws-sdk'
import { config } from '../config'

let sfn: AWS.StepFunctions | null = null

function getSFN(): AWS.StepFunctions {
  if (!sfn) {
    sfn = new AWS.StepFunctions({
      region: config.aws.region,
      accessKeyId: config.aws.access_key_id,
      secretAccessKey: config.aws.secret_access_key,
    })
  }
  return sfn
}

export async function startPaymentExecution(input: {
  booking_id: string
  show_id: string
  razorpay_order_id: string
}): Promise<void> {
  await getSFN().startExecution({
    stateMachineArn: config.step_functions.state_machine_arn,
    name: `payment-${input.razorpay_order_id}`,
    input: JSON.stringify(input),
  }).promise()
}

export async function sendTaskSuccess(task_token: string, output: object): Promise<void> {
  await getSFN().sendTaskSuccess({
    taskToken: task_token,
    output: JSON.stringify(output),
  }).promise()
}
