import { Request, Response, NextFunction } from 'express'
import { SeatService } from '../services/seat.service'
import { BusinessError } from '../errors'

export class SeatController {
  constructor(private readonly seatService: SeatService) {}

  hold = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { show_id, seat_id } = req.body
    if (!show_id || !seat_id) {
      next(new BusinessError('show_id and seat_id are required', 400))
      return
    }
    try {
      const result = await this.seatService.holdSeat(show_id, seat_id, req.user!.sub!)
      res.json(result)
    } catch (err) {
      next(err)
    }
  }

  getSeatMap = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.seatService.getSeatMap(req.params.show_id)
      res.json(result)
    } catch (err) {
      next(err)
    }
  }

  getUserHolds = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const holds = await this.seatService.getUserHolds(req.params.show_id, req.user!.sub!)
      res.json({ holds })
    } catch (err) {
      next(err)
    }
  }

  expireHold = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { show_id, seat_id } = req.body
    if (!show_id || !seat_id) {
      next(new BusinessError('show_id and seat_id are required', 400))
      return
    }
    try {
      await this.seatService.releaseHold(show_id, seat_id)
      res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  }
}
