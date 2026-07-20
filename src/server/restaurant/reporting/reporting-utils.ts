// Pure helpers for the restaurant reporting aggregations. Kept free of I/O so
// they are unit-testable; the service layer feeds them raw SQL group-by rows.

export interface HourlyPoint {
  hour: number
  sales: string
  orders: number
}

export interface DailyPoint {
  date: string
  sales: string
  orders: number
}

export interface HeatmapCell {
  // 0 = Monday … 6 = Sunday (rendering order for LTR/RTL grids).
  dayOfWeek: number
  hour: number
  sales: string
  orders: number
}

// Fills the 24-hour axis so charts do not skip empty hours.
export function fillHourlySeries(
  rows: Array<{ hour: number; sales: string; orders: number }>,
  startHour = 0,
  endHour = 23,
): Array<HourlyPoint> {
  const byHour = new Map(rows.map((row) => [row.hour, row]))
  const series: Array<HourlyPoint> = []
  for (let hour = startHour; hour <= endHour; hour += 1) {
    const row = byHour.get(hour)
    series.push({
      hour,
      sales: row?.sales ?? '0',
      orders: row?.orders ?? 0,
    })
  }
  return series
}

// Fills every calendar day between from/to (inclusive, UTC dates) so trend
// lines render gaps as zeros instead of skipping days.
export function fillDailySeries(
  rows: Array<{ date: string; sales: string; orders: number }>,
  fromIso: string,
  toIso: string,
): Array<DailyPoint> {
  const byDate = new Map(rows.map((row) => [row.date, row]))
  const series: Array<DailyPoint> = []
  const cursor = new Date(`${fromIso.slice(0, 10)}T00:00:00.000Z`)
  const end = new Date(`${toIso.slice(0, 10)}T00:00:00.000Z`)
  while (cursor.getTime() <= end.getTime()) {
    const key = cursor.toISOString().slice(0, 10)
    const row = byDate.get(key)
    series.push({ date: key, sales: row?.sales ?? '0', orders: row?.orders ?? 0 })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return series
}

// Normalizes Postgres DOW (0 = Sunday) into a Monday-first index and fills the
// full 7×24 grid.
export function buildHeatmapGrid(
  rows: Array<{ dow: number; hour: number; sales: string; orders: number }>,
): Array<HeatmapCell> {
  const byKey = new Map(
    rows.map((row) => [`${(row.dow + 6) % 7}:${row.hour}`, row]),
  )
  const grid: Array<HeatmapCell> = []
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      const row = byKey.get(`${dayOfWeek}:${hour}`)
      grid.push({
        dayOfWeek,
        hour,
        sales: row?.sales ?? '0',
        orders: row?.orders ?? 0,
      })
    }
  }
  return grid
}

export function averageTicket(totalSales: string, orderCount: number): string {
  if (orderCount === 0) {
    return '0'
  }
  const average = Number(totalSales) / orderCount
  return Number.isFinite(average) ? average.toFixed(2) : '0'
}
