/**
 * LLM Provider Adapter
 * Supports: Claude, OpenAI, Gemini, Ollama, Groq, Mistral, any OpenAI-compatible
 * Tenant-level config overrides global config (BYOK per tenant)
 */

import { ChatOpenAI } from '@langchain/openai'
import { ChatAnthropic } from '@langchain/anthropic'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { config } from '../config/index.js'
import type { TenantAIConfig, LLMProvider } from '@prisma/client'

export interface LLMAdapterOptions {
  tenantConfig?: TenantAIConfig | null
  /** Override provider (uses global key if tenant config not set) */
  provider?: LLMProvider
  streaming?: boolean
}

export function buildLLM(opts: LLMAdapterOptions = {}): BaseChatModel {
  const tc = opts.tenantConfig
  const provider = tc?.provider ?? opts.provider ?? inferDefaultProvider()
  const streaming = opts.streaming ?? false

  switch (provider) {
    case 'ANTHROPIC':
      return new ChatAnthropic({
        apiKey:      tc?.apiKey ?? config.ai.anthropic ?? '',
        model:       tc?.model  ?? 'claude-sonnet-4-6',
        temperature: tc?.temperature ?? 0.7,
        maxTokens:   tc?.maxTokens ?? 4096,
        streaming,
      })

    case 'OPENAI':
      return new ChatOpenAI({
        apiKey:      tc?.apiKey ?? config.ai.openai ?? '',
        model:       tc?.model  ?? 'gpt-4o',
        temperature: tc?.temperature ?? 0.7,
        maxTokens:   tc?.maxTokens ?? 4096,
        streaming,
      })

    case 'GOOGLE':
      return new ChatGoogleGenerativeAI({
        apiKey:      tc?.apiKey ?? config.ai.google ?? '',
        model:       tc?.model  ?? 'gemini-2.0-flash',
        temperature: tc?.temperature ?? 0.7,
        maxOutputTokens: tc?.maxTokens ?? 4096,
        streaming,
      })

    case 'OLLAMA':
      // Ollama via OpenAI-compatible endpoint
      return new ChatOpenAI({
        apiKey:   'ollama', // required but unused
        model:    tc?.model  ?? 'llama3',
        temperature: tc?.temperature ?? 0.7,
        maxTokens: tc?.maxTokens ?? 4096,
        configuration: {
          baseURL: tc?.baseUrl ?? config.ai.ollamaUrl ?? 'http://localhost:11434/v1',
        },
        streaming,
      })

    case 'GROQ':
      return new ChatOpenAI({
        apiKey:   tc?.apiKey ?? config.ai.groq ?? '',
        model:    tc?.model  ?? 'llama3-70b-8192',
        temperature: tc?.temperature ?? 0.7,
        maxTokens: tc?.maxTokens ?? 4096,
        configuration: { baseURL: 'https://api.groq.com/openai/v1' },
        streaming,
      })

    case 'MISTRAL':
    case 'CUSTOM':
      // Any OpenAI-compatible endpoint
      return new ChatOpenAI({
        apiKey:   tc?.apiKey ?? '',
        model:    tc?.model  ?? 'mistral-large-latest',
        temperature: tc?.temperature ?? 0.7,
        maxTokens: tc?.maxTokens ?? 4096,
        configuration: {
          baseURL: tc?.baseUrl ?? 'https://api.mistral.ai/v1',
        },
        streaming,
      })

    default:
      throw new Error(`Unsupported LLM provider: ${String(provider)}`)
  }
}

function inferDefaultProvider(): LLMProvider {
  if (config.ai.anthropic) return 'ANTHROPIC'
  if (config.ai.openai)    return 'OPENAI'
  if (config.ai.google)    return 'GOOGLE'
  if (config.ai.groq)      return 'GROQ'
  if (config.ai.ollamaUrl) return 'OLLAMA'
  throw new Error(
    'No AI provider configured. Set at least one of: ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_AI_API_KEY, GROQ_API_KEY, OLLAMA_BASE_URL'
  )
}

export type { LLMProvider }
