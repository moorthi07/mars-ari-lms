// Shared types between API and Web
// These mirror Prisma enums/models but are safe to import in the frontend

export type Role = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'INSTRUCTOR' | 'STUDENT' | 'GUEST'
export type CourseStatus = 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED'
export type ContentType = 'TEXT' | 'VIDEO' | 'QUIZ' | 'CODE_SANDBOX' | 'EMBED' | 'SLIDE_DECK' | 'LAB'
export type EnrollmentStatus = 'ACTIVE' | 'COMPLETED' | 'DROPPED' | 'SUSPENDED'
export type IntegrationType = 'WEBHOOK' | 'SDK' | 'LINK'
export type LLMProvider = 'OPENAI' | 'ANTHROPIC' | 'GOOGLE' | 'OLLAMA' | 'GROQ' | 'MISTRAL' | 'CUSTOM'

export interface User {
  id:          string
  tenantId:    string
  email:       string
  displayName: string
  avatarUrl?:  string
  role:        Role
}

export interface Course {
  id:             string
  tenantId:       string
  slug:           string
  title:          string
  description?:   string
  thumbnailUrl?:  string
  status:         CourseStatus
  price?:         number
  currency:       string
  isFree:         boolean
  tags:           string[]
  level?:         string
  estimatedHours?: number
  objectives:     string[]
  createdAt:      string
  updatedAt:      string
}

export interface Module {
  id:          string
  courseId:    string
  title:       string
  description?: string
  position:    number
  isPublished: boolean
  lessons?:    Lesson[]
}

export interface Lesson {
  id:               string
  moduleId:         string
  title:            string
  contentType:      ContentType
  content?:         unknown
  videoUrl?:        string
  position:         number
  isPublished:      boolean
  isFree:           boolean
  estimatedMinutes?: number
}

export interface Integration {
  id:            string
  tenantId:      string
  name:          string
  description?:  string
  type:          IntegrationType
  linkUrl?:      string
  linkTarget?:   string
  sdkPackage?:   string
  sdkConfig?:    unknown
  webhookUrl?:   string
  webhookEvents: string[]
  isActive:      boolean
}

export interface TenantAIConfig {
  id:          string
  tenantId:    string
  provider:    LLMProvider
  model:       string
  isDefault:   boolean
  temperature?: number
  maxTokens?:  number
}

// API response wrappers
export interface PaginatedResponse<T> {
  data:   T[]
  total:  number
  limit:  number
  offset: number
}

export interface ApiError {
  error:  string
  code:   string
  detail?: string
}
