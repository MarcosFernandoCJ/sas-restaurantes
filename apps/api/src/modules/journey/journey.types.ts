export interface ItemBreakdownEntry {
  name: string
  count: number
  totalPrepSecs: number
  totalRevenue: number
}

export interface HourlyEntry {
  orders: number
  revenue: number
}

export interface JourneyMetricsSnapshot {
  sessionId: string
  status: 'open' | 'closed'
  startedAt: string
  endedAt?: string
  ordersCompleted: number
  itemsPrepared: number
  totalRevenue: number
  avgPrepTimeSecs: number
  itemBreakdown: Record<string, ItemBreakdownEntry>
  hourlyBreakdown: Record<string, HourlyEntry>
}
