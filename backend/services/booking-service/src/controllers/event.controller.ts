import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

export class EventController {
  constructor(private prisma: PrismaClient) {}

  listEvents = async (_req: Request, res: Response): Promise<void> => {
    const events = await (this.prisma as any).event.findMany({
      where: { status: 'LIVE' },
      include: { venue: true, price_tiers: true },
      orderBy: { start_at: 'asc' },
    })
    res.json({ events })
  }

  getEvent = async (req: Request, res: Response): Promise<void> => {
    const event = await (this.prisma as any).event.findUnique({
      where: { id: req.params.id },
      include: { venue: true, price_tiers: true },
    })
    if (!event) {
      res.status(404).json({ error: 'Event not found' })
      return
    }
    res.json(event)
  }
}
