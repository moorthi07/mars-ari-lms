/**
 * Quiz Agent — generates quiz questions from lesson content/objectives.
 */
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { z } from 'zod'
import { buildLLM } from '../providers/llm-adapter.js'
import type { TenantAIConfig } from '@prisma/client'

const questionSchema = z.object({
  text:        z.string(),
  type:        z.enum(['multiple_choice', 'true_false', 'short_answer']),
  options:     z.array(z.object({ id: z.string(), text: z.string() })).optional(),
  answer:      z.unknown(),
  points:      z.number().default(1),
  explanation: z.string().optional(),
})

const quizSchema = z.object({
  title:        z.string(),
  passingScore: z.number().default(70),
  questions:    z.array(questionSchema),
})

export type GeneratedQuiz = z.infer<typeof quizSchema>

const QUIZ_PROMPT = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are an expert instructional designer specializing in assessment design.
Create high-quality quiz questions that accurately assess learner understanding.
Respond with valid JSON only — no markdown. Schema:
{{
  "title": string,
  "passingScore": number (percentage, default 70),
  "questions": [
    {{
      "text": string,
      "type": "multiple_choice" | "true_false" | "short_answer",
      "options": [{{"id": "a", "text": string}}] (for multiple_choice only),
      "answer": "a" | true/false | string,
      "points": number,
      "explanation": string (why this answer is correct)
    }}
  ]
}}
Mix question types. For multiple_choice use 4 options (a,b,c,d).
Make distractors plausible but clearly wrong to an informed learner.`,
  ],
  [
    'human',
    `Create {questionCount} quiz questions for:

Course: {courseTitle}
Lesson: {lessonTitle}
Learning objectives:
{objectives}

Generate varied, challenging questions that test real understanding.`,
  ],
])

export interface QuizAgentInput {
  courseTitle:   string
  lessonTitle:   string
  objectives:    string[]
  questionCount?: number
  tenantConfig?: TenantAIConfig | null
}

export async function runQuizAgent(input: QuizAgentInput): Promise<GeneratedQuiz> {
  const llm   = buildLLM({ tenantConfig: input.tenantConfig })
  const chain = QUIZ_PROMPT.pipe(llm).pipe(new StringOutputParser())

  const raw = await chain.invoke({
    courseTitle:   input.courseTitle,
    lessonTitle:   input.lessonTitle,
    objectives:    input.objectives.join('\n- '),
    questionCount: input.questionCount ?? 10,
  })

  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return quizSchema.parse(JSON.parse(cleaned))
}
