import React, { useEffect } from 'react'
import { useAuthStore } from './stores/auth.store.js'

// Pages (lazy loaded)
const Dashboard     = React.lazy(() => import('./pages/Dashboard.js'))
const CourseCatalog = React.lazy(() => import('./pages/CourseCatalog.js'))
const CourseView    = React.lazy(() => import('./pages/CourseView.js'))
const CopilotPage   = React.lazy(() => import('./pages/CopilotPage.js'))
const AdminPanel    = React.lazy(() => import('./pages/AdminPanel.js'))
const SettingsPage  = React.lazy(() => import('./pages/SettingsPage.js'))

import { Sidebar } from './components/layout/Sidebar.js'
import { Loader2 } from 'lucide-react'

export default function App() {
  const { init, isLoading, isAuthenticated } = useAuthStore()

  useEffect(() => { init() }, [init])

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="text-indigo-500 animate-spin" />
          <span className="text-sm text-gray-500">Loading Mars-ari LMS...</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  // Simple hash-based router (replace with TanStack Router in production)
  return <AppRouter />
}

function AppRouter() {
  const [path, setPath] = React.useState(window.location.hash || '#/')

  useEffect(() => {
    const handler = () => setPath(window.location.hash || '#/')
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  const renderPage = () => {
    if (path.startsWith('#/courses/') && path.length > 10) {
      return <CourseView courseId={path.replace('#/courses/', '')} />
    }
    switch (path) {
      case '#/':           return <Dashboard />
      case '#/catalog':    return <CourseCatalog />
      case '#/copilot':    return <CopilotPage />
      case '#/admin':      return <AdminPanel />
      case '#/settings':   return <SettingsPage />
      default:             return <Dashboard />
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      <Sidebar activePath={path} />
      <main className="flex-1 overflow-auto">
        <React.Suspense fallback={
          <div className="h-full flex items-center justify-center">
            <Loader2 size={24} className="text-indigo-500 animate-spin" />
          </div>
        }>
          {renderPage()}
        </React.Suspense>
      </main>
    </div>
  )
}
