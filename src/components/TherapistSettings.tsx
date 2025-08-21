import { useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { useTranslation } from 'react-i18next'

export default function TherapistSettings({ session }: { session: Session }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const uid = session.user.id
        const { data: th } = await supabase.from('therapists').select('name').eq('user_id', uid).maybeSingle()
        if (th?.name) {
          if (mounted) setName(th.name)
        } else {
          const { data: up } = await supabase.from('user_profiles').select('display_name').eq('user_id', uid).maybeSingle()
          if (mounted) setName(up?.display_name || '')
        }
      } catch (e) {
        setError(t('err_fetch_settings') || 'Failed to load settings')
      } finally {
        setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [session, t])

  const onSave = async () => {
    if (!name.trim()) {
      setError(t('err_settings_name_required') || 'Name is required')
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const resp = await fetch('/api/private/set-display-name', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err?.error || 'Failed to save')
      }
      setSuccess(t('settings_saved') || 'Saved')
    } catch (e: any) {
      const msg = (e?.message && String(e.message)) || (t('err_settings_save') as string) || 'Failed to save'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-3">{t('settings_title') || 'Settings'}</h3>
      {loading ? (
        <p className="text-sm text-gray-500">{t('loading_user')}</p>
      ) : (
        <div className="space-y-3">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded">{error}</div>}
          {success && <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded">{success}</div>}
          <label className="block text-sm text-gray-700 mb-1">{t('settings_display_name_label') || 'Display name'}</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('auth_display_name_placeholder') || 'Your name'} />
          <Button onClick={onSave} disabled={saving} className="mt-2">
            {saving ? (t('settings_saving') || 'Saving...') : (t('settings_save') || 'Save')}
          </Button>
        </div>
      )}
    </div>
  )
}
