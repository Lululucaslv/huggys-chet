import React, { createContext, useContext, useState, ReactNode } from 'react'

interface AuthGateContextType {
  isDemoMode: boolean
  registerDrawerOpen: boolean
  registerSource: string | null
  openRegisterDrawer: (source: string) => void
  closeRegisterDrawer: () => void
  gateWriteOperation: (operation: () => void | Promise<void>) => void
}

const AuthGateContext = createContext<AuthGateContextType | null>(null)

export function AuthGateProvider({ 
  children, 
  isAuthenticated 
}: { 
  children: ReactNode
  isAuthenticated: boolean 
}) {
  const [registerDrawerOpen, setRegisterDrawerOpen] = useState(false)
  const [registerSource, setRegisterSource] = useState<string | null>(null)

  const openRegisterDrawer = (source: string) => {
    setRegisterSource(source)
    setRegisterDrawerOpen(true)
  }

  const closeRegisterDrawer = () => {
    setRegisterDrawerOpen(false)
    setRegisterSource(null)
  }

  const gateWriteOperation = (operation: () => void | Promise<void>) => {
    if (!isAuthenticated) {
      openRegisterDrawer('write-operation')
      return
    }
    operation()
  }

  const value = {
    isDemoMode: !isAuthenticated,
    registerDrawerOpen,
    registerSource,
    openRegisterDrawer,
    closeRegisterDrawer,
    gateWriteOperation,
  }

  return <AuthGateContext.Provider value={value}>{children}</AuthGateContext.Provider>
}

export function useAuthGate() {
  const context = useContext(AuthGateContext)
  if (!context) throw new Error('useAuthGate must be used within AuthGateProvider')
  return context
}
