export interface HoldRequest {
  show_id: string
  seat_id: string
}

export interface HoldResponse {
  success: boolean
  expires_at: number
}

export interface WsAuthResponse {
  token: string
  expires_in: number
}

export interface ApiError {
  error: string
}
