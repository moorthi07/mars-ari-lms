/**
 * Content Agent
 * Generates full lesson content given a lesson stub from the curriculum agent.
 * Supports: rich text, code examples, slide outlines.
 */

import { ChatPromptTemplate } from '@langchain/core/prompts'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { z } from 'zod'
import { buildLLM } from '../providers/llm-adapter.js'
import type { TenantAIConfig } from '@prisma/client'

// ─── Content block schema ─────────────────────────────────────────────────────

export const contentBlockSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('heading'),
    level: z.number().int().min(1).max(3),
    text: z.string(),
  }),
  z.object({
    type: z.literal('paragraph'),
    text: z.string(),
  }),
  z.object({
    type: z.literal('code'),
    language: z.string(),
    code: z.string(),
    caption: z.string().optional(),
  }),
  z.object({
    type: z.literal('callout'),
    variant: z.enum(['info', 'warning', 'tip', 'important']),
    text: z.string(),
  }),
  z.object({
    type: z.literal('list'),
    ordered: z.boolean(),
    items: z.array(z.string()),
  }),
  z.object({
    type: z.literal('image_prompt'),
    prompt: z.string(),   // used by media agent to generate/search an image
    alt: z.string(),
    caption: z.string().optional(),
  }),
  z.object({
    type: z.literal('video_search'),
    query: z.string(),    // used by media agent to find YouTube video
    rationale: z.string(),
  }),
  z.object({
    type: z.literal('slide'),
    title: z.string(),
    bullets: z.array(z.string()),
    speakerNotes: z.string().optional(),
  }),
])

export const lessonContentSchema = z.object({
  title:    z.string(),
  summary:  z.string(),
  blocks:   z.array(contentBlockSchema),
  keywords: z.array(z.string()),
})

export type ContentBlock = z.infer<typeof contentBlockSchema>
export type LessonContent = z.infer<typeof lessonContentSchema>

// ─── Prompt ───────────────────────────────────────────────────────────────────

const CONTENT_PROMPT = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are an expert course content writer and instructional designer.
You write engaging, accurate, and pedagogically effective lesson content.

Respond with valid JSON only — no markdown fences. Schema:
{{
  "title": string,
  "summary": string (1 sentence overview),
  "blocks": ContentBlock[],
  "keywords": string[]
}}

ContentBlock types (use discriminated union by "type"):
- {{"type":"heading","level":1|2|3,"text":string}}
- {{"type":"paragraph","text":string}} 
- {{"type":"code","language":string,"code":string,"caption":string?}}
- {{"type":"callout","variant":"info"|"warning"|"tip"|"important","text":string}}
- {{"type":"list","ordered":boolean,"items":string[]}}
- {{"type":"image_prompt","prompt":string,"alt":string,"caption":string?}}
- {{"type":"video_search","query":string,"rationale":string}}
- {{"type":"slide","title":string,"bullets":string[],"speakerNotes":string?}}

Guidelines:
- Start with a heading block (level 1)
- Include 2-4 paragraphs of thorough explanation
- Add relevant code examples for technical topics
- Use callouts for important tips or warnings
- Include 1-2 image_prompt blocks for visual concepts
- Include 1 video_search block for supplementary video
- For SLIDE_DECK type lessons, use mostly slide blocks
- For CODE_SANDBOX type lessons, include detailed code blocks
- Write at an appropriate level: {level}
- Be specific to the domain: {domain}`,
  ],
  [
    'human',
    `Write complete lesson content for:

Course: {courseTitle}
Module: {moduleTitle}  
Lesson: {lessonTitle}
Content type: {contentType}
Learning objectives: {objectives}
Estimated duration: {estimatedMinutes} minutes

Generate rich, comprehensive lesson content now.`,
  ],
])

// ─── Agent ────────────────────────────────────────────────────────────────────

export interface ContentAgentInput {
  courseTitle:      string
  moduleTitle:      string
  lessonTitle:      string
  contentType:      string
  objectives:       string[]
  estimatedMinutes: number
  level?:           string
  domain?:          string
  tenantConfig?:    TenantAIConfig | null
}

export async function runContentAgent(
  input: ContentAgentInput
): Promise<LessonContent> {
  const llm = buildLLM({ tenantConfig: input.tenantConfig })
  const chain = CONTENT_PROMPT.pipe(llm).pipe(new StringOutputParser())

  const raw = await chain.invoke({
    courseTitle:      input.courseTitle,
    moduleTitle:      input.moduleTitle,
    lessonTitle:      input.lessonTitle,
    contentType:      input.contentType,
    objectives:       input.objectives.join('\n- '),
    estimatedMinutes: input.estimatedMinutes,
    level:            input.level ?? 'intermediate',
    domain:           input.domain ?? 'general',
  })

  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const parsed = JSON.parse(cleaned) as unknown
  return lessonContentSchema.parse(parsed)
}

export async function* streamContentAgent(
  input: ContentAgentInput
): AsyncGenerator<string> {
  const llm = buildLLM({ tenantConfig: input.tenantConfig, streaming: true })
  const chain = CONTENT_PROMPT.pipe(llm).pipe(new StringOutputParser())

  const stream = await chain.stream({
    courseTitle:      input.courseTitle,
    moduleTitle:      input.moduleTitle,
    lessonTitle:      input.lessonTitle,
    contentType:      input.contentType,
    objectives:       input.objectives.join('\n- '),
    estimatedMinutes: input.estimatedMinutes,
    level:            input.level ?? 'intermediate',
    domain:           input.domain ?? 'general',
  })

  for await (const chunk of stream) {
    yield chunk
  }
}
