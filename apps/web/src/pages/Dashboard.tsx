import { useQuery } from '@tanstack/react-query'
import { BookOpen, Users, TrendingUp, Award, ArrowRight, Wand2 } from 'lucide-react'
import { enrollmentApi, courseApi } from '../lib/api.js'
import { useAuthStore } from '../stores/auth.store.js'

export default function Dashboard() {
  const { user, hasRole } = useAuthStore()

  const { data: enrollments } = useQuery({
    queryKey: ['enrollments', 'me'],
    queryFn:  () => enrollmentApi.myEnrollments().then((r) => r.data),
  })

  const { data: courses } = useQuery({
    queryKey: ['courses', 'published'],
    queryFn:  () => courseApi.list({ status: 'PUBLISHED', limit: 6 }).then((r) => r.data),
  })

  const stats = [
    { label: 'Courses enrolled',  value: enrollments?.length ?? 0,  icon: <BookOpen size={20} />,  color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' },
    { label: 'Completed',         value: enrollments?.filter((e: any) => e.status === 'COMPLETED').length ?? 0, icon: <Award size={20} />, color: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' },
    { label: 'In progress',       value: enrollments?.filter((e: any) => e.status === 'ACTIVE').length ?? 0,    icon: <TrendingUp size={20} />, color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' },
    { label: 'Certificates',      value: 0, icon: <Award size={20} />,  color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400' },
  ]

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome back, {user?.displayName?.split(' ')[0]} 👋
        </h1>
        <p className="text-gray-500 mt-1">Here's what's happening with your learning.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
              {s.icon}
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{s.value}</div>
            <div className="text-sm text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* AI Copilot CTA for instructors */}
      {hasRole(['INSTRUCTOR', 'TENANT_ADMIN', 'SUPER_ADMIN']) && (
        <div className="card p-6 bg-gradient-to-r from-indigo-600 to-purple-600 border-0 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Wand2 size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Create a course with AI</h3>
                <p className="text-indigo-100 text-sm mt-0.5">
                  Describe your course and AI generates the full curriculum, lessons, quizzes, and media.
                </p>
              </div>
            </div>
            <a
              href="#/copilot"
              className="flex items-center gap-2 bg-white text-indigo-700 hover:bg-indigo-50 px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors flex-shrink-0 ml-4"
            >
              Open Copilot <ArrowRight size={16} />
            </a>
          </div>
        </div>
      )}

      {/* Recent courses */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Available courses</h2>
          <a href="#/catalog" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
            View all <ArrowRight size={14} />
          </a>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(courses?.data ?? []).map((course: any) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      </div>
    </div>
  )
}

function CourseCard({ course }: { course: any }) {
  return (
    <a href={`#/courses/${course.id}`} className="card p-5 hover:shadow-md transition-shadow block group">
      {course.thumbnailUrl && (
        <img src={course.thumbnailUrl} alt={course.title} className="w-full h-36 object-cover rounded-lg mb-3" />
      )}
      <div className="flex items-center gap-2 mb-2">
        {course.level && <span className="badge badge-blue capitalize">{course.level}</span>}
        {course.isFree
          ? <span className="badge badge-green">Free</span>
          : <span className="text-sm font-semibold text-gray-900 dark:text-white">${course.price}</span>
        }
      </div>
      <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
        {course.title}
      </h3>
      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{course.description}</p>
      {course.estimatedHours && (
        <div className="text-xs text-gray-400 mt-3 flex items-center gap-1">
          <BookOpen size={12} />
          {course.estimatedHours}h · {course._count?.modules ?? 0} modules
        </div>
      )}
    </a>
  )
}
