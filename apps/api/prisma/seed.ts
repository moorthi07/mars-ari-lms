/**
 * Prisma seed — creates demo tenant, users, and a sample course
 * Run: npm run db:seed --workspace=apps/api
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding Mars-ari LMS...')

  // ── Demo tenant ────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where:  { slug: 'demo' },
    update: {},
    create: {
      slug:         'demo',
      name:         'Demo Organization',
      domain:       null,
      primaryColor: '#6366f1',
      accentColor:  '#8b5cf6',
      planTier:     'pro',
    },
  })
  console.log(`✅ Tenant: ${tenant.name} (${tenant.id})`)

  // ── Demo users ─────────────────────────────────────────────────────────────
  const adminUser = await prisma.user.upsert({
    where:  { keycloakId: 'seed-admin-001' },
    update: {},
    create: {
      keycloakId:  'seed-admin-001',
      tenantId:    tenant.id,
      email:       'admin@demo.marsarilms.io',
      displayName: 'Admin User',
      role:        'TENANT_ADMIN',
    },
  })

  const instructorUser = await prisma.user.upsert({
    where:  { keycloakId: 'seed-instructor-001' },
    update: {},
    create: {
      keycloakId:  'seed-instructor-001',
      tenantId:    tenant.id,
      email:       'instructor@demo.marsarilms.io',
      displayName: 'Jane Instructor',
      role:        'INSTRUCTOR',
    },
  })

  const studentUser = await prisma.user.upsert({
    where:  { keycloakId: 'seed-student-001' },
    update: {},
    create: {
      keycloakId:  'seed-student-001',
      tenantId:    tenant.id,
      email:       'student@demo.marsarilms.io',
      displayName: 'John Student',
      role:        'STUDENT',
    },
  })
  console.log('✅ Users created: admin, instructor, student')

  // ── AI config (no real keys — shows the structure) ─────────────────────────
  await prisma.tenantAIConfig.upsert({
    where:  { tenantId_provider: { tenantId: tenant.id, provider: 'ANTHROPIC' } },
    update: {},
    create: {
      tenantId:    tenant.id,
      provider:    'ANTHROPIC',
      model:       'claude-sonnet-4-6',
      isDefault:   true,
      temperature: 0.7,
      maxTokens:   4096,
    },
  })
  console.log('✅ AI config created (Anthropic default)')

  // ── Sample course: Teleoperator Fundamentals ───────────────────────────────
  const course = await prisma.course.upsert({
    where:  { tenantId_slug: { tenantId: tenant.id, slug: 'teleoperator-fundamentals' } },
    update: {},
    create: {
      tenantId:       tenant.id,
      slug:           'teleoperator-fundamentals',
      title:          'Teleoperator Fundamentals',
      description:    'Master the principles of remote robotic arm operation. Learn safety protocols, control interfaces, and data collection best practices for teleoperation systems.',
      status:         'PUBLISHED',
      isFree:         false,
      price:          99.99,
      currency:       'usd',
      level:          'intermediate',
      estimatedHours: 12,
      tags:           ['robotics', 'teleoperation', 'remote-control', 'safety', 'physical-ai'],
      objectives: [
        'Understand the architecture of teleoperation systems',
        'Operate robotic arms safely via remote interfaces',
        'Collect and validate teleoperation training data',
        'Diagnose and respond to system faults in real time',
        'Apply safety protocols in live robot environments',
      ],
      prerequisites:  ['Basic computer operation', 'Familiarity with robotics concepts'],
      publishedAt:    new Date(),
    },
  })

  // Author
  await prisma.courseAuthor.upsert({
    where:  { courseId_userId: { courseId: course.id, userId: instructorUser.id } },
    update: {},
    create: { courseId: course.id, userId: instructorUser.id, role: 'author' },
  })

  // Module 1
  const mod1Id = 'aaaa0001-0000-4000-8000-000000000000'
  const mod1 = await prisma.module.upsert({
    where:  { id: mod1Id },
    update: {},
    create: {
      id:          mod1Id,
      courseId:    course.id,
      title:       'Introduction to Teleoperation',
      description: 'Core concepts, history, and system overview.',
      position:    1,
      isPublished: true,
    },
  })

  // Lessons for Module 1
  const lessons1 = [
    { title: 'What is Teleoperation?',           contentType: 'TEXT',  position: 1, estimatedMinutes: 15 },
    { title: 'System Architecture Overview',      contentType: 'SLIDE_DECK', position: 2, estimatedMinutes: 20 },
    { title: 'Safety Protocols and Procedures',   contentType: 'VIDEO', position: 3, estimatedMinutes: 25 },
    { title: 'Module 1 Assessment',               contentType: 'QUIZ',  position: 4, estimatedMinutes: 10 },
  ]

  for (const l of lessons1) {
    const lessonId = `aaaa0001-0001-4000-8000-00000000000${l.position}`
    await prisma.lesson.upsert({
      where:  { id: lessonId },
      update: {},
      create: {
        id:               lessonId,
        moduleId:         mod1.id,
        title:            l.title,
        contentType:      l.contentType as any,
        position:         l.position,
        isPublished:      true,
        isFree:           l.position === 1,
        estimatedMinutes: l.estimatedMinutes,
        content: {
          blocks: [
            { type: 'heading', level: 1, text: l.title },
            { type: 'paragraph', text: `This lesson covers: ${l.title}. Full AI-generated content will be populated via the Copilot Studio.` },
          ],
        },
      },
    })
  }

  // Module 2
  const mod2Id = 'aaaa0002-0000-4000-8000-000000000000'
  const mod2 = await prisma.module.upsert({
    where:  { id: mod2Id },
    update: {},
    create: {
      id:          mod2Id,
      courseId:    course.id,
      title:       'Control Interfaces and Haptics',
      description: 'Hands-on operation with various control devices.',
      position:    2,
      isPublished: true,
    },
  })

  const lessons2 = [
    { title: 'Controller Types and Selection',    contentType: 'TEXT',         position: 1, estimatedMinutes: 20 },
    { title: 'Haptic Feedback Systems',           contentType: 'VIDEO',        position: 2, estimatedMinutes: 30 },
    { title: 'Hands-on: Your First Session',      contentType: 'CODE_SANDBOX', position: 3, estimatedMinutes: 45 },
    { title: 'Module 2 Assessment',               contentType: 'QUIZ',         position: 4, estimatedMinutes: 10 },
  ]

  for (const l of lessons2) {
    const lessonId = `aaaa0002-0001-4000-8000-00000000000${l.position}`
    await prisma.lesson.upsert({
      where:  { id: lessonId },
      update: {},
      create: {
        id:               lessonId,
        moduleId:         mod2.id,
        title:            l.title,
        contentType:      l.contentType as any,
        position:         l.position,
        isPublished:      true,
        isFree:           false,
        estimatedMinutes: l.estimatedMinutes,
      },
    })
  }

  // ── Demo webhook integration (teleop platform) ─────────────────────────────
  const integration1Id = 'cccc0001-0000-4000-8000-000000000000'
  await prisma.integration.upsert({
    where:  { id: integration1Id },
    update: {},
    create: {
      id:            integration1Id,
      tenantId:      tenant.id,
      name:          'Teleop Platform',
      description:   'Notifies the robotic teleoperation platform on course events',
      type:          'WEBHOOK',
      webhookUrl:    'https://your-teleop-platform.example.com/lms-events',
      webhookSecret: 'replace-with-real-secret',
      webhookEvents: ['COURSE_ENROLLED', 'COURSE_COMPLETED', 'QUIZ_PASSED', 'CERTIFICATE_ISSUED'],
    },
  })

  const integration2Id = 'cccc0002-0000-4000-8000-000000000000'
  await prisma.integration.upsert({
    where:  { id: integration2Id },
    update: {},
    create: {
      id:          integration2Id,
      tenantId:    tenant.id,
      name:        'Live Robot Lab',
      description: 'Opens the live robot lab environment from within a lesson',
      type:        'LINK',
      linkUrl:     'https://lab.your-teleop-platform.example.com',
      linkTarget:  'iframe',
    },
  })

  // SDK integration example
  const integration3Id = 'cccc0003-0000-4000-8000-000000000000'
  await prisma.integration.upsert({
    where:  { id: integration3Id },
    update: {},
    create: {
      id:          integration3Id,
      tenantId:    tenant.id,
      name:        'TeleTrain SDK',
      description: 'Embeds TeleTrain data collection widget directly in lessons',
      type:        'SDK',
      sdkPackage:  '@your-org/teletrain-lms-sdk',
      sdkConfig:   { apiEndpoint: 'https://api.teletrain.example.com', mode: 'embedded' },
    },
  })

  console.log(`✅ Sample course created: ${course.title}`)
  console.log('✅ Integrations: webhook, link, SDK')
  console.log('\n🎉 Mars-ari LMS seed complete!')
  console.log('\nDemo credentials (configure in Keycloak):')
  console.log('  admin@demo.marsarilms.io      — TENANT_ADMIN')
  console.log('  instructor@demo.marsarilms.io — INSTRUCTOR')
  console.log('  student@demo.marsarilms.io    — STUDENT')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
