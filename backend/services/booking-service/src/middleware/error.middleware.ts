import { Request, Response, NextFunction } from 'express'

export interface AppError extends Error {
  statusCode?: number
}

export function errorMiddleware(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = err.statusCode || 500
  const message = status < 500 ? err.message : 'Internal server error'
  if (status >= 500) console.error('[Error]', err)
  res.status(status).json({ error: message })
}
