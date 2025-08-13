export interface TimezoneOption {
  value: string
  label: string
}

export const US_CANADA_TIMEZONES: TimezoneOption[] = [
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Halifax', label: 'Atlantic Time (AT)' },
  { value: 'America/St_Johns', label: 'Newfoundland Time (NT)' },
  { value: 'America/Vancouver', label: 'Pacific Time - Vancouver' },
  { value: 'America/Edmonton', label: 'Mountain Time - Edmonton' },
  { value: 'America/Winnipeg', label: 'Central Time - Winnipeg' },
  { value: 'America/Toronto', label: 'Eastern Time - Toronto' }
]

export const formatDateTimeInTimezone = (
  dateTimeString: string, 
  timezone: string
): string => {
  const date = new Date(dateTimeString)
  return date.toLocaleString('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

export const formatDisplayDateTime = (
  dateTimeString: string, 
  timezone: string
): string => {
  const date = new Date(dateTimeString)
  return date.toLocaleString('en-US', {
    timeZone: timezone,
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

export const convertLocalToUTC = (
  localDateTimeString: string, 
  timezone: string
): string => {
  const tempDate = new Date(localDateTimeString)
  const utcTime = tempDate.getTime() + (tempDate.getTimezoneOffset() * 60000)
  const targetTime = new Date(utcTime + (getTimezoneOffset(timezone) * 60000))
  return targetTime.toISOString()
}

export const convertUTCToLocal = (
  utcDateTimeString: string,
  timezone: string
): string => {
  const date = new Date(utcDateTimeString)
  const localDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }))
  const year = localDate.getFullYear()
  const month = String(localDate.getMonth() + 1).padStart(2, '0')
  const day = String(localDate.getDate()).padStart(2, '0')
  const hours = String(localDate.getHours()).padStart(2, '0')
  const minutes = String(localDate.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function getTimezoneOffset(timezone: string): number {
  const now = new Date()
  const utc = new Date(now.getTime() + (now.getTimezoneOffset() * 60000))
  const target = new Date(utc.toLocaleString('en-US', { timeZone: timezone }))
  return (target.getTime() - utc.getTime()) / 60000
}
