/**
 * @mars-ari/sdk — Integration SDK for external platforms
 *
 * Three integration modes (matching the LMS Integration model):
 *
 * 1. LINK  — open LMS course/lesson in a new tab or iframe
 * 2. SDK   — embed Mars-ari LMS widget inside your platform
 * 3. WEBHOOK — receive LMS events on your server
 *
 * Usage (external platform, e.g. your teleop platform):
 *
 *   import { MarsAriLMS } from '@mars-ari/sdk'
 *
 *   const lms = new MarsAriLMS({
 *     baseUrl: 'https://lms.your-org.com',
 *     apiKey:  'marsari_key_...',
 *     tenantSlug: 'your-tenant',
 *   })
 *
 *   // Enroll a user from your platform
 *   await lms.enroll({ externalUserId: 'robot-op-42', courseSlug: 'teleoperator-fundamentals' })
 *
 *   // Embed a lesson widget
 *   lms.embed({ lessonId: '...', containerId: 'lesson-container' })
 *
 *   // Listen to events via polling or webhook
 *   lms.onEvent('COURSE_COMPLETED', (event) => { ... })
 */

export interface MarsAriLMSConfig {
  /** Base URL of your Mars-ari LMS instance, e.g. https://lms.your-org.com */
  baseUrl:    string
  /** API key from Mars-ari LMS admin panel */
  apiKey:     string
  /** Your tenant slug */
  tenantSlug: string
}

export interface EnrollOptions {
  /** User ID in your external platform */
  externalUserId: string
  /** Course slug in Mars-ari LMS */
  courseSlug: string
  /** Optional metadata passed back in webhook events */
  metadata?: Record<string, unknown>
}

export interface EmbedOptions {
  /** Lesson ID to embed */
  lessonId:    string
  /** DOM element ID to mount the widget into */
  containerId: string
  /** Width of the embedded iframe (default: 100%) */
  width?:      string
  /** Height of the embedded iframe (default: 600px) */
  height?:     string
  /** JWT token for the current user (single-sign-on) */
  userToken?:  string
}

export type LMSEventType =
  | 'COURSE_ENROLLED'
  | 'LESSON_COMPLETED'
  | 'COURSE_COMPLETED'
  | 'QUIZ_PASSED'
  | 'QUIZ_FAILED'
  | 'CERTIFICATE_ISSUED'
  | 'PAYMENT_SUCCEEDED'

export interface LMSEvent {
  event:      LMSEventType
  tenantId:   string
  userId:     string
  courseId?:  string
  lessonId?:  string
  timestamp:  string
  data:       Record<string, unknown>
}

export class MarsAriLMS {
  private readonly config: MarsAriLMSConfig
  private readonly eventHandlers = new Map<string, Array<(event: LMSEvent) => void>>()

  constructor(config: MarsAriLMSConfig) {
    this.config = config
  }

  // ── REST helpers ─────────────────────────────────────────────────────────────

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.config.baseUrl}/api/v1${path}`
    const resp = await fetch(url, {
      ...options,
      headers: {
        'Content-Type':  'application/json',
        'X-Marsari-Key':    this.config.apiKey,
        'X-Marsari-Tenant': this.config.tenantSlug,
        ...options.headers,
      },
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      throw new Error(`Mars-ari LMS API error ${resp.status}: ${JSON.stringify(err)}`)
    }
    return resp.json() as Promise<T>
  }

  // ── Enrollment ───────────────────────────────────────────────────────────────

  /**
   * Enroll an external user in a course.
   * Mars-ari LMS will match the externalUserId to a known user or create a guest record.
   */
  async enroll(options: EnrollOptions): Promise<{ enrollmentId: string }> {
    return this.request('/sdk/enroll', {
      method: 'POST',
      body:   JSON.stringify(options),
    })
  }

  /**
   * Get a user's course progress.
   */
  async getProgress(externalUserId: string, courseSlug: string): Promise<{
    status:           string
    completedLessons: number
    totalLessons:     number
    percentComplete:  number
    lastAccessedAt:   string | null
  }> {
    return this.request(`/sdk/progress?userId=${externalUserId}&course=${courseSlug}`)
  }

  // ── Link mode ────────────────────────────────────────────────────────────────

  /**
   * Generate a direct link to a course or lesson (LINK integration mode).
   * Opens in a new tab or can be placed in an anchor.
   */
  courseLink(courseSlug: string, userToken?: string): string {
    const base = `${this.config.baseUrl}/courses/${courseSlug}`
    return userToken ? `${base}?sso=${encodeURIComponent(userToken)}` : base
  }

  lessonLink(lessonId: string, userToken?: string): string {
    const base = `${this.config.baseUrl}/lessons/${lessonId}`
    return userToken ? `${base}?sso=${encodeURIComponent(userToken)}` : base
  }

  // ── Embed mode ───────────────────────────────────────────────────────────────

  /**
   * Embed an Mars-ari LMS lesson as an iframe inside your platform (SDK integration mode).
   * Mounts an <iframe> into the specified container.
   */
  embed(options: EmbedOptions): () => void {
    const container = document.getElementById(options.containerId)
    if (!container) throw new Error(`Container #${options.containerId} not found`)

    const src = new URL(`${this.config.baseUrl}/embed/lessons/${options.lessonId}`)
    src.searchParams.set('tenant', this.config.tenantSlug)
    if (options.userToken) src.searchParams.set('sso', options.userToken)

    const iframe = document.createElement('iframe')
    iframe.src             = src.toString()
    iframe.width           = options.width  ?? '100%'
    iframe.height          = options.height ?? '600px'
    iframe.style.border    = 'none'
    iframe.style.borderRadius = '12px'
    iframe.allow           = 'fullscreen; camera; microphone'
    iframe.allowFullscreen = true

    // Listen for postMessage events from the embedded LMS
    const messageHandler = (event: MessageEvent) => {
      if (event.origin !== new URL(this.config.baseUrl).origin) return
      const data = event.data as { type?: string; payload?: LMSEvent }
      if (data?.type === 'mars-ari:event' && data.payload) {
        this.dispatchEvent(data.payload)
      }
    }
    window.addEventListener('message', messageHandler)

    container.innerHTML = ''
    container.appendChild(iframe)

    // Return cleanup function
    return () => {
      window.removeEventListener('message', messageHandler)
      container.innerHTML = ''
    }
  }

  // ── Webhook verification ──────────────────────────────────────────────────────

  /**
   * Verify an incoming webhook signature from Mars-ari LMS.
   * Use this on your server to validate that events are genuinely from Mars-ari LMS.
   *
   * Example (Express):
   *   app.post('/lms-events', express.raw({ type: 'application/json' }), (req, res) => {
   *     const isValid = lms.verifyWebhook(req.body, req.headers['x-marsari-signature'], 'your-secret')
   *     if (!isValid) return res.status(401).send('Invalid signature')
   *     const event = JSON.parse(req.body)
   *     // handle event...
   *   })
   */
  async verifyWebhook(
    rawBody:   string | Buffer,
    signature: string,
    secret:    string
  ): Promise<boolean> {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    const body = typeof rawBody === 'string' ? rawBody : new TextDecoder().decode(rawBody)
    const mac  = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
    const hex  = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, '0')).join('')
    const expected = `sha256=${hex}`
    return expected === signature
  }

  // ── Event system ──────────────────────────────────────────────────────────────

  /**
   * Register a handler for LMS events (received via iframe postMessage or polling).
   */
  onEvent(type: LMSEventType | '*', handler: (event: LMSEvent) => void): () => void {
    const key = type
    if (!this.eventHandlers.has(key)) this.eventHandlers.set(key, [])
    this.eventHandlers.get(key)!.push(handler)
    return () => {
      const handlers = this.eventHandlers.get(key) ?? []
      const idx = handlers.indexOf(handler)
      if (idx >= 0) handlers.splice(idx, 1)
    }
  }

  private dispatchEvent(event: LMSEvent): void {
    for (const handler of this.eventHandlers.get(event.event) ?? []) handler(event)
    for (const handler of this.eventHandlers.get('*') ?? []) handler(event)
  }
}

// Default export for convenience
export default MarsAriLMS
