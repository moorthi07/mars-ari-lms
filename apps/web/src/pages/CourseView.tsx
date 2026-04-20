// CourseView page stub
export default function CourseView({ courseId }: { courseId: string }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Course View</h1>
      <p className="text-gray-500">courseId: {courseId}</p>
      <p className="text-gray-400 mt-2 text-sm">Full lesson player, quiz engine, progress tracking — Phase 2 build.</p>
    </div>
  )
}
