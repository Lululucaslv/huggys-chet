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
      try {
        const resp = await fetch(`/api/private/ensure-therapist-code?userId=${encodeURIComponent(userId)}`)
        if (resp.ok) {
          const json = await resp.json()
          if (mounted && json?.code) {
            setCode(json.code)
            return
          }
        }
      } catch {}
      try {
        let { data } = await supabase
          .from('therapists')
          .select('code')
          .eq('user_id', userId)
          .maybeSingle()
        const existing = data?.code || null
        if (mounted) setCode(existing || '—')
        if (!existing) {
          let newCode: string | null = null
          try {
            const { data: gen } = await supabase.rpc('gen_therapist_code', { len: 8 })
            if (typeof gen === 'string' && gen.trim()) newCode = gen.trim()
          } catch {}
          if (!newCode) {
            const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
            newCode = Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
          }
          if (newCode) {
            const { data: upd } = await supabase
              .from('therapists')
              .update({ code: newCode })
              .eq('user_id', userId)
              .select('code')
              .maybeSingle()
            if (mounted && (upd?.code || newCode)) setCode(upd?.code || newCode)
          }
        }
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
      <span className="font-mono text-gray-900">{code}</span>
      <Button variant="outline" size="sm" onClick={onCopy} disabled={!code || code === '—' || copying}>
        <Copy className="h-4 w-4 mr-1" />
        {copying ? '已复制' : '复制'}
      </Button>
    </div>
  )
}
