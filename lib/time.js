export function localToUTCISOString(localStr, tz) {
  if (!localStr) return null
  const s = String(localStr).trim().replace('T', ' ')
  const [date, time] = s.split(' ')
  if (!date || !time) return null
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
  const base = new Date(Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0))
  const offsetMin = getTzOffsetMinutes(base, tz || 'UTC', fmt)
  const utcMs = base.getTime() - offsetMin * 60000
  return new Date(utcMs).toISOString()
}

function getTzOffsetMinutes(dateUtc, tz, fmt) {
  const parts = Object.fromEntries(fmt.formatToParts(dateUtc).map(p => [p.type, p.value]))
  const localMs = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second)
  return Math.round((localMs - dateUtc.getTime()) / 60000)
}
