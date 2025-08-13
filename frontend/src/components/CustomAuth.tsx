import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { UserPlus, LogIn, Shield, User } from 'lucide-react'

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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('请填写邮箱和密码')
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
      setError('登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || !confirmPassword) {
      setError('请填写所有必填字段')
      return
    }

    if (password !== confirmPassword) {
      setError('密码确认不匹配')
      return
    }

    if (password.length < 6) {
      setError('密码长度至少6位')
      return
    }

    if (userRole === 'therapist') {
      const validInviteCode = (import.meta as any).env.VITE_THERAPIST_INVITE_CODE
      if (!inviteCode || inviteCode !== validInviteCode) {
        setError('治疗师邀请码无效')
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
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert([
            {
              user_id: data.user.id,
              interest: 'therapy',
              language: 'zh-CN',
              life_status: userRole,
              timezone: 'America/New_York'
            }
          ])

        if (profileError) {
          console.error('Error creating user profile:', profileError)
        }

        onAuthSuccess()
      }
    } catch (err) {
      setError('注册失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-900">
          MoreThanHugs 疗愈平台
        </h1>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isLogin ? (
                <>
                  <LogIn className="h-5 w-5" />
                  登录
                </>
              ) : (
                <>
                  <UserPlus className="h-5 w-5" />
                  注册
                </>
              )}
            </CardTitle>
            <CardDescription>
              {isLogin ? '登录您的账户' : '创建新账户'}
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
                <Label htmlFor="email">邮箱地址</Label>
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
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  required
                />
              </div>

              {!isLogin && (
                <>
                  <div>
                    <Label htmlFor="confirmPassword">确认密码</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="请再次输入密码"
                      required
                    />
                  </div>

                  <div>
                    <Label>选择角色</Label>
                    <RadioGroup
                      value={userRole}
                      onValueChange={(value) => setUserRole(value as 'client' | 'therapist')}
                      className="mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="client" id="client" />
                        <Label htmlFor="client" className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          来访者 (客户)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="therapist" id="therapist" />
                        <Label htmlFor="therapist" className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          治疗师
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {userRole === 'therapist' && (
                    <div>
                      <Label htmlFor="inviteCode">治疗师邀请码</Label>
                      <Input
                        id="inviteCode"
                        type="text"
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value)}
                        placeholder="请输入邀请码"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        注册治疗师账户需要有效的邀请码
                      </p>
                    </div>
                  )}
                </>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full"
              >
                {loading ? (isLogin ? '登录中...' : '注册中...') : (isLogin ? '登录' : '注册')}
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
                {isLogin ? '没有账户？点击注册' : '已有账户？点击登录'}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
