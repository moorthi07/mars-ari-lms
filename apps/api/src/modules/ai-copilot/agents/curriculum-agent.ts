/**
 * Curriculum Agent
 * Given a course title + description, generates a full structured curriculum:
 * modules → lessons → learning objectives + quiz stubs
 * Streams results back for real-time UI population.
 */

import { ChatPromptTemplate } from '@langchain/core/prompts'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { z } from 'zod'
import { buildLLM } from '../providers/llm-adapter.js'
import type { TenantAIConfig } from '@prisma/client'

// ─── Output schema ────────────────────────────────────────────────────────────

export const lessonStubSchema = z.object({
  title:           z.string(),
  contentType:     z.enum(['TEXT', 'VIDEO', 'QUIZ', 'CODE_SANDBOX', 'SLIDE_DECK']),
  description:     z.string(),
  estimatedMinutes: z.number(),
  objectives:      z.array(z.string()),
  hasQuiz:         z.boolean(),
})

export const moduleStubSchema = z.object({
  title:       z.string(),
  description: z.string(),
  lessons:     z.array(lessonStubSchema),
})

export const curriculumSchema = z.object({
  title:           z.string(),
  description:     z.string(),
  level:           z.enum(['beginner', 'intermediate', 'advanced']),
  estimatedHours:  z.number(),
  objectives:      z.array(z.string()),
  prerequisites:   z.array(z.string()),
  tags:            z.array(z.string()),
  modules:         z.array(moduleStubSchema),
})

export type Curriculum = z.infer<typeof curriculumSchema>
export type ModuleStub = z.infer<typeof moduleStubSchema>
export type LessonStub = z.infer<typeof lessonStubSchema>

// ─── Prompt ───────────────────────────────────────────────────────────────────

const CURRICULUM_PROMPT = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are an expert instructional designer and curriculum architect. 
You create comprehensive, well-structured online course curricula that are engaging, 
pedagogically sound, and optimized for learner outcomes.

Always respond with valid JSON only — no markdown fences, no extra text.
The JSON must match this exact schema:
{{
  "title": string,
  "description": string (2-3 sentences),
  "level": "beginner" | "intermediate" | "advanced",
  "estimatedHours": number,
  "objectives": string[] (5-8 clear learning outcomes starting with action verbs),
  "prerequisites": string[] (what learners should know before starting),
  "tags": string[] (5-10 relevant keywords),
  "modules": [
    {{
      "title": string,
      "description": string,
      "lessons": [
        {{
          "title": string,
          "contentType": "TEXT" | "VIDEO" | "QUIZ" | "CODE_SANDBOX" | "SLIDE_DECK",
          "description": string,
          "estimatedMinutes": number,
          "objectives": string[] (2-3 per lesson),
          "hasQuiz": boolean
        }}
      ]
    }}
  ]
}}

Guidelines:
- Create 4-8 modules per course
- Each module should have 3-6 lessons
- Mix content types: readings, videos, quizzes, code sandboxes
- Add a quiz lesson at the end of each module
- Final module should include a capstone/project lesson
- Be specific and domain-accurate — not generic`,
  ],
  [
    'human',
    `Create a comprehensive curriculum for this course:

Title: {title}
Description: {description}
Target audience: {audience}
Special requirements: {requirements}

Generate the full curriculum now.`,
  ],
])

// ─── Agent ────────────────────────────────────────────────────────────────────

export interface CurriculumAgentInput {
  title:        string
  description:  string
  audience?:    string
  requirements?: string
  tenantConfig?: TenantAIConfig | null
}

export async function runCurriculumAgent(
  input: CurriculumAgentInput
): Promise<Curriculum> {
  const llm = buildLLM({ tenantConfig: input.tenantConfig })
  const chain = CURRICULUM_PROMPT.pipe(llm).pipe(new StringOutputParser())

  const raw = await chain.invoke({
    title:        input.title,
    description:  input.description,
    audience:     input.audience ?? 'general learners',
    requirements: input.requirements ?? 'none',
  })

  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const parsed = JSON.parse(cleaned) as unknown
  return curriculumSchema.parse(parsed)
}

/**
 * Streaming variant — yields chunks for SSE responses.
 * The frontend can display content as it arrives.
 */
export async function* streamCurriculumAgent(
  input: CurriculumAgentInput
): AsyncGenerator<string> {
  const llm = buildLLM({ tenantConfig: input.tenantConfig, streaming: true })
  const chain = CURRICULUM_PROMPT.pipe(llm).pipe(new StringOutputParser())

  const stream = await chain.stream({
    title:        input.title,
    description:  input.description,
    audience:     input.audience ?? 'general learners',
    requirements: input.requirements ?? 'none',
  })

  for await (const chunk of stream) {
    yield chunk
  }
}
