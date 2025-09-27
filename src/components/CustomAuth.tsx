import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { RadioGroup, RadioGroupItem } from './ui/radio-group'
import { Label } from './ui/label'
import { UserPlus, LogIn, Shield, User } from 'lucide-react'

import { useTranslation } from 'react-i18next'
interface CustomAuthProps {
  onAuthSuccess: () => void
}

export default function CustomAuth({ onAuthSuccess }: CustomAuthProps) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [userRole, setUserRole] = useState<'client' | 'therapist'>('client')
  const [inviteCode, setInviteCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const { i18n } = useTranslation()
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Please enter email and password')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
        return
      }

      onAuthSuccess()
    } catch (err) {
      setError('Login failed, please try again')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all required fields')
      return
    }

    if (password !== confirmPassword) {
      setError('Password confirmation does not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (userRole === 'therapist') {
      const validInviteCode = 'THERAPIST2024'
      if (!inviteCode || inviteCode !== validInviteCode) {
        setError('Invalid therapist invite code')
        return
      }
      if (userRole === 'therapist' && !displayName.trim()) {
        setError('Please enter your name')
        return
      }
    }

    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        setError(error.message)
        return
      }

      if (data.user) {
        const userId = data.user.id
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert([
            {
              user_id: userId,
              interest: 'therapy',
              language: (i18n.resolvedLanguage === 'zh' ? 'zh-CN' : i18n.resolvedLanguage) || 'en',
              life_status: userRole,
              timezone: 'America/New_York'
            }
          ])

        if (profileError) {
          console.error('Error creating user profile:', profileError)
        }

        if (userRole === 'therapist') {
          let code = null as string | null
          try {
            const { data: gen } = await supabase.rpc('gen_therapist_code', { len: 8 })
            if (typeof gen === 'string') code = gen
          } catch {}
          const fallbackName = (email || '').split('@')[0] || 'Therapist'
          const nameToUse = (typeof displayName === 'string' && displayName.trim()) ? displayName.trim() : fallbackName
          try {
            await supabase
              .from('therapists')
              .upsert(
                {
                  user_id: userId,
                  name: nameToUse,
                  specialization: 'General',
                  verified: true,
                  code: code || null
                },
                { onConflict: 'user_id' }
              )
          } catch (e) {
            console.error('Error upserting therapist:', e)
          }
          try {
            await supabase
              .from('user_profiles')
              .update({ display_name: nameToUse })
              .eq('user_id', userId)
          } catch {}
        }

        onAuthSuccess()
      }
    } catch (err) {
      setError('Registration failed, please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0a0a0a' }}>
      <div className="max-w-md w-full rounded-lg p-6 border border-purple-400/30" style={{ backgroundColor: '#111111' }}>
        <h1 className="text-2xl font-bold text-center mb-6 text-white">
          Huggys.ai
        </h1>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isLogin ? (
                <>
                  <LogIn className="h-5 w-5" />
                  Login
                </>
              ) : (
                <>
                  <UserPlus className="h-5 w-5" />
                  Register
                </>
              )}
            </CardTitle>
            <CardDescription>
              {isLogin ? 'Sign in to your account' : 'Create a new account'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                />
              </div>

              {!isLogin && (
                <>
                  <div>
                    <Label htmlFor="confirmPassword">Confirm password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      required
                    />
                  </div>

                  <div>
                    <Label>Select role</Label>
                    <RadioGroup
                      value={userRole}
                      onValueChange={(value) => setUserRole(value as 'client' | 'therapist')}
                      className="mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="client" id="client" />
                        <Label htmlFor="client" className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Client
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="therapist" id="therapist" />
                        <Label htmlFor="therapist" className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Therapist
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {userRole === 'therapist' && (
                    <div>
                      <Label htmlFor="inviteCode">Therapist invite code</Label>
                      <Input
                        id="inviteCode"
                        type="text"
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value)}
                        placeholder="Enter invite code"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        A valid invite code is required to register as a therapist
                      </p>
                      <div>
                        <Label htmlFor="displayName">Name</Label>
                        <Input
                          id="displayName"
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="e.g., Hanqi Lyu"
                          required
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full"
              >
                {loading ? (isLogin ? 'Logging in...' : 'Registering...') : (isLogin ? 'Login' : 'Register')}
              </Button>
            </form>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin)
                  setError('')
                  setEmail('')
                  setPassword('')
                  setConfirmPassword('')
                  setInviteCode('')
                }}
                className="text-blue-600 hover:text-blue-700 text-sm"
              >
                {isLogin ? 'No account? Register' : 'Already have an account? Login'}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
