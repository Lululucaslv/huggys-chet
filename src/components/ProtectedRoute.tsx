import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Session } from '@supabase/supabase-js'

interface ProtectedRouteProps {
  children: ReactNode
  session: Session | null
  userRole: string | null
  requiredRole?: string
  roleLoading: boolean
}

export default function ProtectedRoute({ 
  children, 
  session, 
  userRole, 
  requiredRole = 'client',
  roleLoading 
}: ProtectedRouteProps) {
  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-purple-900">
        <div className="text-center">
          <p className="text-gray-300">加载用户信息中...</p>
        </div>
      </div>
    )
  }

  if (requiredRole && userRole !== requiredRole) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
