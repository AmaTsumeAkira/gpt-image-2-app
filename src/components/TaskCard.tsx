import { useEffect, useState } from 'react'
import type { TaskRecord } from '../types'

interface Props {
  task: TaskRecord
  onReuse: () => void
  onDelete: () => void
  onClick: () => void
}

export default function TaskCard({ task, onReuse, onDelete, onClick }: Props) {
  const [thumbSrc, setThumbSrc] = useState<string>('')
  const [now, setNow] = useState(Date.now())

  // 定时更新运行中任务的计时
  useEffect(() => {
    if (task.status !== 'in_progress' && task.status !== 'submitted') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [task.status])

  // 加载缩略图
  useEffect(() => {
    if (task.outputUrls?.[0]) {
      setThumbSrc(task.outputUrls[0])
    }
  }, [task.outputUrls])

  const duration = (() => {
    let seconds: number
    if (task.status === 'submitted' || task.status === 'in_progress') {
      seconds = Math.floor((now - task.createdAt) / 1000)
    } else if (task.elapsed != null) {
      seconds = Math.floor(task.elapsed / 1000)
    } else {
      return '00:00'
    }
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
    const ss = String(seconds % 60).padStart(2, '0')
    return `${mm}:${ss}`
  })()

  const statusLabel =
    task.status === 'submitted' ? '提交中' :
    task.status === 'in_progress' ? '生成中' :
    task.status === 'completed' ? '已完成' : '失败'

  const statusColors: Record<string, string> = {
    submitted: 'border-blue-300',
    in_progress: 'border-blue-400',
    completed: 'border-gray-200',
    failed: 'border-red-300',
  }

  return (
    <div
      className={`bg-white rounded-xl border overflow-hidden cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg ${statusColors[task.status]}`}
      onClick={onClick}
    >
      <div className="flex h-40">
        {/* 左侧图片区域 */}
        <div className="w-40 min-w-[10rem] h-full bg-gray-100 relative flex items-center justify-center overflow-hidden flex-shrink-0">
          {(task.status === 'submitted' || task.status === 'in_progress') && (
            <div className="flex flex-col items-center gap-2">
              <svg className="w-8 h-8 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs text-gray-400">{statusLabel}</span>
            </div>
          )}
          {task.status === 'failed' && (
            <div className="flex flex-col items-center gap-1 px-2">
              <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs text-red-400 text-center leading-tight">失败</span>
            </div>
          )}
          {task.status === 'completed' && thumbSrc && (
            <>
              <img src={thumbSrc} className="w-full h-full object-cover" loading="lazy" alt="" />
              {task.outputUrls.length > 1 && (
                <span className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                  {task.outputUrls.length}
                </span>
              )}
            </>
          )}
          {task.status === 'completed' && !thumbSrc && (
            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          )}

          {/* 左上角状态/时间标签 */}
          <div className="absolute top-1.5 left-1.5">
            <span className="flex items-center gap-1 bg-black/50 text-white text-[10px] sm:text-xs px-1.5 py-0.5 rounded backdrop-blur-sm font-mono">
              {(task.status === 'submitted' || task.status === 'in_progress') && (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {duration}
            </span>
          </div>

          {/* 进度百分比 */}
          {task.status === 'in_progress' && task.progress > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
              <div
                className="h-full bg-blue-500 transition-all duration-500"
                style={{ width: `${task.progress}%` }}
              />
            </div>
          )}
        </div>

        {/* 右侧信息区域 */}
        <div className="flex-1 p-3 flex flex-col min-w-0">
          <div className="flex-1 min-h-0 mb-2">
            <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">
              {task.prompt || '(无提示词)'}
            </p>
          </div>

          <div className="flex items-center justify-between text-[11px] text-gray-400 mt-auto">
            <span>
              {task.params.size !== 'auto' ? `${task.params.size} ${task.params.resolution}` : task.params.size}
              {task.params.quality !== 'auto' && ` · ${task.params.quality}`}
            </span>
            <span className="font-mono">{statusLabel}</span>
          </div>

          <div className="flex gap-1 mt-2 border-t border-gray-100 pt-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onReuse()
              }}
              className="flex-1 text-[11px] py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
            >
              复用
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className="px-2 text-[11px] py-1 rounded-lg bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
