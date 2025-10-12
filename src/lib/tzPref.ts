const KEY = "tz_pref";

export function getTzPref(): string {
  return localStorage.getItem(KEY) || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function setTzPref(tz: string): void {
  localStorage.setItem(KEY, tz);
}
