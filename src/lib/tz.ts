import { DateTime } from 'luxon';

export function toLocal(utcISO: string, tz: string): DateTime | null {
  try {
    return DateTime.fromISO(utcISO, { zone: 'utc' }).setZone(tz);
  } catch {
    return null;
  }
}

export function toUTC(localISO: string, tz: string): DateTime | null {
  try {
    return DateTime.fromISO(localISO, { zone: tz }).toUTC();
  } catch {
    return null;
  }
}

export function fmt(dt: DateTime | null, format: string): string {
  if (!dt || !dt.isValid) return '—';
  return dt.toFormat(format);
}
