import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Button } from '../ui/button'
import { Copy } from 'lucide-react'

export default function TherapistCodeDisplay({ userId }: { userId: string }) {
  const [code, setCode] = useState<string>('—')
  const [copying, setCopying] = useState(false)

  useEffect(() => {
    let mounted = true
    const run = async () => {
      const ensureOnce = async (): Promise<{ code: string; persisted: boolean } | null> => {
        try {
          const resp = await fetch(`/api/private/ensure-therapist-code?userId=${encodeURIComponent(userId)}`)
          if (resp.ok) {
            const json = await resp.json()
            if (json?.code) return { code: json.code, persisted: !!json.persisted }
          }
        } catch {}
        return null
      }

      for (let i = 0; i < 4; i++) {
        const got = await ensureOnce()
        if (mounted && got?.code) {
          setCode(got.code)
          if (got.persisted) return
        }
        await new Promise(r => setTimeout(r, 500))
      }

      try {
        let { data } = await supabase
          .from('therapists')
          .select('code')
          .eq('user_id', userId)
          .maybeSingle()
        const existing = data?.code || null
        if (mounted) setCode(existing || '—')
      } catch {}
    }
    run()
    return () => { mounted = false }
  }, [userId])

  const onCopy = async () => {
    try {
      setCopying(true)
      await navigator.clipboard.writeText(code)
    } finally {
      setTimeout(() => setCopying(false), 600)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-white">{code}</span>
      <Button variant="outline" size="sm" onClick={onCopy} disabled={!code || code === '—' || copying}>
        <Copy className="h-4 w-4 mr-1" />
        {copying ? '已复制' : '复制'}
      </Button>
    </div>
  )
}
