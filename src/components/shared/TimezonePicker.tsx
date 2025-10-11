import { useState, useEffect } from "react";

const COMMON = [
  "UTC",
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney"
];

export function TimezonePicker({
  value,
  onChange
}: {
  value?: string;
  onChange?: (tz: string) => void;
}) {
  const [tz, setTz] = useState(
    value || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  );

  useEffect(() => {
    onChange?.(tz);
  }, [tz, onChange]);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Timezone</label>
      <select
        className="h-10 w-full rounded-[var(--radius-input)] border border-[var(--line)] bg-transparent px-3"
        value={tz}
        onChange={(e) => setTz(e.target.value)}
      >
        {[tz, ...COMMON.filter((x) => x !== tz)].map((z) => (
          <option key={z} value={z}>
            {z}
          </option>
        ))}
      </select>
      <p className="text-xs text-[var(--muted)]">
        All times are shown in your timezone.
      </p>
    </div>
  );
}
