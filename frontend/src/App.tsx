import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { Session } from '@supabase/supabase-js'
import TherapistSchedule from './components/TherapistSchedule'
import ClientBooking from './components/ClientBooking'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [roleLoading, setRoleLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        fetchUserRole(session)
      } else {
        setRoleLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        fetchUserRole(session)
      } else {
        setUserRole(null)
        setRoleLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchUserRole = async (session: Session) => {
    setRoleLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('life_status')
        .eq('user_id', session.user.id)
        .single()

      if (error && error.code === 'PGRST116') {
        setUserRole('client')
      } else if (error) {
        console.error('Error fetching user role:', error)
        setUserRole('client') // Default to client on error
      } else {
        setUserRole(data.life_status || 'client')
      }
    } catch (err) {
      console.error('Error:', err)
      setUserRole('client') // Default to client on error
    } finally {
      setRoleLoading(false)
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-center mb-6 text-gray-900">
            MoreThanHugs 疗愈平台
          </h1>
          <Auth 
            supabaseClient={supabase} 
            appearance={{ theme: ThemeSupa }}
            providers={[]}
            redirectTo={window.location.origin}
          />
        </div>
      </div>
    )
  }

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">加载用户信息中...</p>
        </div>
      </div>
    )
  }

  const isTherapist = userRole === 'therapist'
  const pageTitle = isTherapist ? '治疗师日程管理' : '预约咨询'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-gray-900">
              {pageTitle}
            </h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                {isTherapist ? '治疗师' : '来访者'}: {session.user.email}
              </span>
              <button
                onClick={() => supabase.auth.signOut()}
                className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
              >
                退出登录
              </button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {isTherapist ? (
          <TherapistSchedule session={session} />
        ) : (
          <ClientBooking session={session} />
        )}
      </main>
    </div>
  )
}

export default App
