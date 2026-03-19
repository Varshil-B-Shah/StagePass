export interface Venue {
  id: string
  name: string
  address: string
  city: string
  state: string
  capacity: number
}

export interface PriceTier {
  id: string
  name: string
  price: number
}

export interface Event {
  id: string
  title: string
  description: string | null
  venue_id: string
  venue: Venue
  start_at: string
  end_at: string
  status: 'DRAFT' | 'LIVE' | 'COMPLETED' | 'CANCELLED'
  price_tiers: PriceTier[]
}
