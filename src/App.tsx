import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { Session } from '@supabase/supabase-js'
import TherapistSchedule from './components/TherapistSchedule'
import ClientBooking from './components/ClientBooking'
import CustomAuth from './components/CustomAuth'
import ProtectedRoute from './components/ProtectedRoute'
import ChatPage from './pages/ChatPage'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from './components/LanguageSwitcher'
import AIChat from './components/AIChat'
import { Dialog, DialogContent } from './components/ui/dialog'
import { MessageCircle, Settings } from 'lucide-react'
import TherapistSettings from './components/TherapistSettings'

function App() {
  const { t } = useTranslation()
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
        setUserRole('client')
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

  return (
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={
            session ? <Navigate to="/" replace /> : <CustomAuth onAuthSuccess={() => {}} />
          } 
        />
        <Route 
          path="/chat" 
          element={
            <ProtectedRoute 
              session={session} 
              userRole={userRole} 
              requiredRole="client"
              roleLoading={roleLoading}
            >
              <ChatPage session={session!} />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/" 
          element={
            session ? (
              roleLoading ? (
                <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-gray-500">{t('loading_user')}</p>
                  </div>
                </div>
              ) : (
                <MainDashboard session={session} userRole={userRole} />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />
      </Routes>
    </Router>
  )
}

function MainDashboard({ session, userRole }: { session: Session, userRole: string | null }) {
  const { t } = useTranslation()
  const isTherapist = userRole === 'therapist'
  const pageTitle = isTherapist ? t('app_title_therapist') : t('app_title_client')

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-gray-900">
              {pageTitle}
            </h1>
            <div className="flex items-center gap-4">
              {!isTherapist && (
                <Link 
                  to="/chat"
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 transform hover:scale-105"
                >
                  {t('nav_chat')}
                </Link>
              )}
              <span className="text-sm text-gray-500">
                {pageTitle}: {session.user.email}
              </span>
              <LanguageSwitcher />
              {isTherapist && (
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-800 px-3 py-2 rounded-md text-sm font-medium"
                >
                  <Settings className="h-4 w-4" />
                  {t('settings_title') || 'Settings'}
                </button>
              )}
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className="max-w-md p-0">
            <TherapistSettings session={session} />
          </DialogContent>
        </Dialog>

              <button
                onClick={() => supabase.auth.signOut()}
                className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
              >
                {t('sign_out')}
              </button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="relative max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {isTherapist ? (
          <>
            <TherapistSchedule session={session} />
            <button
              aria-label="Open AI assistant"
              onClick={() => setChatOpen(true)}
              className="fixed bottom-6 right-6 bg-purple-600 hover:bg-purple-700 text-white rounded-full p-4 shadow-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              <MessageCircle className="h-6 w-6" />
            </button>
            <Dialog open={chatOpen} onOpenChange={setChatOpen}>
              <DialogContent className="max-w-2xl p-0">
                <AIChat session={session} />
              </DialogContent>
            </Dialog>
          </>
        ) : (
          <ClientBooking session={session} />
        )}
      </main>
    </div>
  )
}

export default App
