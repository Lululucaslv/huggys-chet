import { DateTime } from 'luxon';

export const DEFAULT_TZ = 'America/Los_Angeles';

export function getTZ(tz?: string | null) {
  return tz && DateTime.now().setZone(tz).isValid ? tz : DEFAULT_TZ;
}

export function parseLocalToUTC(local: string, tz?: string) {
  const zone = getTZ(tz || undefined);
  const dt = DateTime.fromFormat(local, 'yyyy-MM-dd HH:mm', { zone });
  if (!dt.isValid) throw new Error(`Invalid local time: ${local} (${tz})`);
  return dt.toUTC();
}

export function toDisplay(dtUTC: DateTime, tz?: string) {
  const zone = getTZ(tz || undefined);
  const local = dtUTC.setZone(zone);
  return {
    utc: dtUTC.toISO({ suppressMilliseconds: true }),
    local: local.toFormat('yyyy-MM-dd HH:mm ZZZZ'),
    tz: zone,
    abbr: local.toFormat('ZZZ'),
    offset: local.toFormat('ZZ'),
  };
}

export function rangeDisplay(startUTCISO: string, endUTCISO: string, tz?: string) {
  const start = DateTime.fromISO(startUTCISO, { zone: 'utc' });
  const end = DateTime.fromISO(endUTCISO, { zone: 'utc' });
  return {
    start: toDisplay(start, tz),
    end: toDisplay(end, tz),
  };
}
