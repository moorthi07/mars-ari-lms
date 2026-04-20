import React from 'react'
import {
  LayoutDashboard, BookOpen, Wand2, Users, Settings,
  LogOut, ChevronRight, GraduationCap, Zap
} from 'lucide-react'
import { useAuthStore } from '../../stores/auth.store.js'

interface NavItem {
  label:    string
  icon:     React.ReactNode
  href:     string
  roles?:   string[]
  badge?:   string
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',    icon: <LayoutDashboard size={18} />, href: '#/' },
  { label: 'Course Catalog', icon: <BookOpen size={18} />,      href: '#/catalog' },
  { label: 'AI Copilot',   icon: <Wand2 size={18} />,           href: '#/copilot', roles: ['INSTRUCTOR', 'TENANT_ADMIN', 'SUPER_ADMIN'], badge: 'AI' },
  { label: 'Admin Panel',  icon: <Users size={18} />,            href: '#/admin',   roles: ['TENANT_ADMIN', 'SUPER_ADMIN'] },
  { label: 'Settings',     icon: <Settings size={18} />,         href: '#/settings' },
]

export function Sidebar({ activePath }: { activePath: string }) {
  const { user, logout, hasRole } = useAuthStore()

  const visibleItems = NAV_ITEMS.filter((item) =>
    !item.roles || item.roles.some((r) => hasRole(r as any))
  )

  return (
    <aside className="layout-sidebar flex flex-col z-10">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
          <Zap size={16} className="text-white" />
        </div>
        <div>
          <span className="font-bold text-gray-900 dark:text-white text-sm">Mars-ari LMS</span>
          <div className="text-xs text-gray-400 leading-none">{user?.tenantId ? 'Workspace' : ''}</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = activePath === item.href
          return (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group
                ${isActive
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                }`}
            >
              <span className={isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'}>
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="badge badge-purple text-xs">{item.badge}</span>
              )}
              {isActive && <ChevronRight size={14} className="text-indigo-400" />}
            </a>
          )
        })}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group">
          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
            {user?.avatarUrl
              ? <img src={user.avatarUrl} alt={user.displayName} className="w-8 h-8 rounded-full object-cover" />
              : <GraduationCap size={16} className="text-indigo-600 dark:text-indigo-400" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.displayName}</div>
            <div className="text-xs text-gray-500 truncate capitalize">{user?.role.toLowerCase().replace('_', ' ')}</div>
          </div>
          <button
            onClick={logout}
            title="Logout"
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}
