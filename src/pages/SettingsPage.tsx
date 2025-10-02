import { useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import TherapistCodeDisplay from '../components/fragments/TherapistCodeDisplay'
import { useTranslation } from 'react-i18next'

export default function SettingsPage({ session }: { session: Session }) {
  const { t } = useTranslation()
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [pwNotice, setPwNotice] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setDisplayName(data?.display_name || ''))
  }, [session.user.id])

  const saveProfile = async () => {
    setNotice(null)
    setSaving(true)
    const { error } = await supabase
      .from('user_profiles')
      .update({ display_name: displayName })
      .eq('user_id', session.user.id)
    setSaving(false)
    if (error) setNotice(error.message || t('err_update_profile') || 'Failed')
    else setNotice(t('saved') || 'Saved')
  }

  const changePassword = async () => {
    setPwNotice(null)
    if ((newPassword || '').length < 8) {
      setPwNotice(t('pw_minlen') || 'Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwNotice(t('pw_mismatch') || 'Passwords do not match')
      return
    }
    setPwSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwSaving(false)
    if (error) setPwNotice(error.message || t('pw_change_failed') || 'Failed to change password')
    else {
      setPwNotice(t('pw_changed') || 'Password updated')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings_profile') || 'Profile'}</CardTitle>
          <CardDescription>{t('settings_profile_desc') || 'Update your public display information'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {notice && <div className="text-sm text-gray-600">{notice}</div>}
          <div>
            <label className="block text-sm text-gray-700 mb-1">{t('nickname') || 'Nickname'}</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">{t('therapist_code') || 'Therapist code'}</label>
            <div className="text-gray-900"><TherapistCodeDisplay userId={session.user.id} /></div>
          </div>
          <Button onClick={saveProfile} disabled={saving}>{saving ? (t('saving') || 'Saving...') : (t('save') || 'Save')}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings_security') || 'Security'}</CardTitle>
          <CardDescription>{t('settings_security_desc') || 'Update your password'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pwNotice && <div className="text-sm text-gray-600">{pwNotice}</div>}
          <div>
            <label className="block text-sm text-gray-700 mb-1">{t('new_password') || 'New password'}</label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">{t('confirm_password') || 'Confirm password'}</label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          <Button onClick={changePassword} disabled={pwSaving}>{pwSaving ? (t('saving') || 'Saving...') : (t('change_password') || 'Change password')}</Button>
        </CardContent>
      </Card>
    </div>
  )
}
