/**
 * Auth store — wraps Keycloak, exposes user, token, and role helpers.
 * Supports SSO via Keycloak OIDC.
 */
import { create } from 'zustand'
import Keycloak from 'keycloak-js'

export type Role = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'INSTRUCTOR' | 'STUDENT' | 'GUEST'

export interface AuthUser {
  id:          string
  keycloakId:  string
  tenantId:    string
  email:       string
  displayName: string
  avatarUrl?:  string
  role:        Role
}

interface AuthState {
  keycloak:        Keycloak | null
  user:            AuthUser | null
  token:           string | null
  isAuthenticated: boolean
  isLoading:       boolean
  error:           string | null

  init:     () => Promise<void>
  login:    () => void
  logout:   () => void
  hasRole:  (role: Role | Role[]) => boolean
  getToken: () => Promise<string>
}

const ROLE_LEVEL: Record<Role, number> = {
  GUEST: 0, STUDENT: 1, INSTRUCTOR: 2, TENANT_ADMIN: 3, SUPER_ADMIN: 4,
}

const kc = new Keycloak({
  url:      import.meta.env['VITE_KEYCLOAK_URL'],
  realm:    import.meta.env['VITE_KEYCLOAK_REALM'] ?? 'mars-ari',
  clientId: import.meta.env['VITE_KEYCLOAK_CLIENT_ID'] ?? 'mars-ari-web',
})

export const useAuthStore = create<AuthState>((set, get) => ({
  keycloak:        null,
  user:            null,
  token:           null,
  isAuthenticated: false,
  isLoading:       true,
  error:           null,

  init: async () => {
    try {
      const authenticated = await kc.init({
        onLoad:            'login-required',
        checkLoginIframe:  false,
        pkceMethod:        'S256',
      })

      if (authenticated) {
        const profile = await kc.loadUserProfile()
        // Fetch marsari db user from API
        const resp = await fetch('/api/v1/auth/me', {
          headers: { Authorization: `Bearer ${kc.token}` },
        })
        const marsAriUser: AuthUser = await resp.json()

        set({
          keycloak:        kc,
          user:            marsAriUser,
          token:           kc.token ?? null,
          isAuthenticated: true,
          isLoading:       false,
        })

        // Auto-refresh token before expiry
        kc.onTokenExpired = () => {
          kc.updateToken(30).then((refreshed) => {
            if (refreshed) set({ token: kc.token ?? null })
          })
        }
      } else {
        set({ isLoading: false })
      }
    } catch (err) {
      set({ error: 'Authentication failed', isLoading: false })
    }
  },

  login:  () => kc.login(),
  logout: () => kc.logout({ redirectUri: window.location.origin }),

  hasRole: (role) => {
    const user = get().user
    if (!user) return false
    const userLevel = ROLE_LEVEL[user.role]
    const roles = Array.isArray(role) ? role : [role]
    return roles.some((r) => userLevel >= ROLE_LEVEL[r])
  },

  getToken: async () => {
    await kc.updateToken(30)
    return kc.token ?? ''
  },
}))
