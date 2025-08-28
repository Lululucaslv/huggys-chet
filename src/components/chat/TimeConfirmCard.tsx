import { Button } from '../ui/button';

type Props = {
  therapist?: { name?: string; code?: string } | string;
  date: string | null;
  startTime: string | null;
  endTime?: string | null;
  timezone: string | null;
  onConfirm: (payload: any) => void;
  onCancel?: () => void;
  candidates?: Array<{ date: string; startTime: string; endTime?: string }>;
};

export function TimeConfirmCard({
  therapist,
  date,
  startTime,
  endTime,
  timezone,
  onConfirm,
  onCancel,
  candidates = []
}: Props) {
  const displayTherapist =
    typeof therapist === 'string'
      ? therapist
      : [therapist?.name, therapist?.code ? `(${therapist.code})` : '']
          .filter(Boolean)
          .join(' ');

  return (
    <div className="rounded-lg border p-3 space-y-2 bg-background">
      <div className="text-sm font-semibold">请确认预约时间</div>
      <div className="text-sm text-muted-foreground">
        咨询师：{displayTherapist || '—'}
      </div>
      <div className="text-sm">
        日期：<b>{date || '—'}</b>，时间：<b>{startTime || '—'}{endTime ? ` - ${endTime}` : ''}</b>（时区：{timezone || '浏览器时区'}）
      </div>

      {candidates.length > 0 && (
        <div className="text-sm">
          也可以选择以下候选：
          <div className="flex flex-wrap gap-2 mt-2">
            {candidates.map((c, i) => (
              <Button
                key={i}
                size="sm"
                variant="secondary"
                onClick={() =>
                  onConfirm({
                    date: c.date,
                    startTime: c.startTime,
                    endTime: c.endTime || null
                  })
                }
              >
                {c.date} {c.startTime}{c.endTime ? `-${c.endTime}` : ''}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button
          size="sm"
          onClick={() =>
            onConfirm({ date, startTime, endTime: endTime || null, timezone })
          }
          disabled={!date || !startTime}
        >
          确认预约
        </Button>
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            返回修改
          </Button>
        )}
      </div>
    </div>
  );
}
