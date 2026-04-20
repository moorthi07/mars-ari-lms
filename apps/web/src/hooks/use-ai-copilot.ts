/**
 * useAICopilot — React hook that drives the AI course generation SSE stream.
 * Exposes streaming state so the UI can render content as it arrives.
 */
import { useState, useCallback, useRef } from 'react'
import { useAuthStore } from '../stores/auth.store.js'

export type CopilotStatus = 'idle' | 'streaming' | 'done' | 'error'

export interface StreamState {
  status:   CopilotStatus
  raw:      string           // raw accumulated JSON string
  error:    string | null
  progress: number           // 0-100 estimated
}

type GenerateEndpoint = 'generate-curriculum' | 'generate-lesson'

export function useAICopilot() {
  const [state, setState] = useState<StreamState>({
    status: 'idle', raw: '', error: null, progress: 0,
  })
  const abortRef = useRef<AbortController | null>(null)
  const getToken = useAuthStore((s) => s.getToken)

  const stream = useCallback(
    async (endpoint: GenerateEndpoint, body: Record<string, unknown>) => {
      // Cancel any in-flight request
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setState({ status: 'streaming', raw: '', error: null, progress: 5 })

      try {
        const token = await getToken()
        const resp = await fetch(
          `${import.meta.env['VITE_API_URL'] ?? 'http://localhost:3001'}/api/v1/ai-copilot/${endpoint}`,
          {
            method:  'POST',
            headers: {
              'Content-Type':  'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body:   JSON.stringify({ ...body, stream: true }),
            signal: controller.signal,
          }
        )

        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        if (!resp.body) throw new Error('No response body')

        const reader  = resp.body.getReader()
        const decoder = new TextDecoder()
        let   accumulated = ''
        let   charCount   = 0
        const estimatedTotal = 3000 // rough char estimate for progress

        while (true) {
          const { value, done } = await reader.read()
          if (done) break

          const text = decoder.decode(value, { stream: true })
          // Parse SSE lines: "data: {...}\n\n"
          const lines = text.split('\n')
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const payload = line.slice(6).trim()
            if (payload === '[DONE]') {
              setState((prev) => ({ ...prev, status: 'done', progress: 100 }))
              return
            }
            try {
              const parsed = JSON.parse(payload) as { chunk?: string; error?: string }
              if (parsed.error) {
                setState((prev) => ({ ...prev, status: 'error', error: parsed.error ?? 'Unknown error' }))
                return
              }
              if (parsed.chunk) {
                accumulated += parsed.chunk
                charCount   += parsed.chunk.length
                setState({
                  status:   'streaming',
                  raw:      accumulated,
                  error:    null,
                  progress: Math.min(95, Math.round((charCount / estimatedTotal) * 100)),
                })
              }
            } catch {
              // partial SSE chunk — ignore
            }
          }
        }

        setState((prev) => ({ ...prev, status: 'done', progress: 100 }))
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return
        setState((prev) => ({
          ...prev,
          status: 'error',
          error:  err instanceof Error ? err.message : 'Generation failed',
        }))
      }
    },
    [getToken]
  )

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setState({ status: 'idle', raw: '', error: null, progress: 0 })
  }, [])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setState((prev) => ({ ...prev, status: 'idle' }))
  }, [])

  return { state, stream, reset, cancel }
}

/** Parse accumulated JSON safely — returns null if incomplete */
export function tryParseJSON<T>(raw: string): T | null {
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleaned) as T
  } catch {
    return null
  }
}
