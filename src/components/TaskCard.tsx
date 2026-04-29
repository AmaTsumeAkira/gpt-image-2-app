import { useEffect, useState, useRef } from 'react'
import type { TaskRecord } from '../types'
import { useStore, getCachedRemoteUrl, getCacheVersion, getThumbnail, moveTasksToFolder } from '../store'

interface Props {
  task: TaskRecord
  selected: boolean
  onReuse: () => void
  onDelete: () => void
  onClick: () => void
  onToggleSelect: () => void
}

export default function TaskCard({ task, selected, onReuse, onDelete, onClick, onToggleSelect }: Props) {
  const [thumbSrc, setThumbSrc] = useState<string>('')
  const [isCached, setIsCached] = useState(false)
  const [thumbError, setThumbError] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const folderPickerRef = useRef<HTMLDivElement>(null)
  const folders = useStore((s) => s.folders)

  // 点击外部关闭文件夹选择器
  useEffect(() => {
    if (!showFolderPicker) return
    const handleClick = (e: MouseEvent) => {
      if (folderPickerRef.current && !folderPickerRef.current.contains(e.target as Node)) {
        setShowFolderPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showFolderPicker])

  // 定时更新运行中任务的计时
  useEffect(() => {
    if (task.status !== 'in_progress' && task.status !== 'submitted') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [task.status])

  // 加载缩略图：优先本地缓存 → 远程 URL，生成降分辨率预览
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const url = task.outputUrls?.[0]
      if (!url) return
      setThumbError(false)

      let src: string
      let cached = false
      if (/^https?:\/\//i.test(url)) {
        const c = getCachedRemoteUrl(url)
        src = c || url
        cached = !!c
      } else {
        src = url
        cached = true
      }

      // 异步生成缩略图（大幅降低内存占用）
      const thumb = await getThumbnail(src)
      if (!cancelled) {
        setThumbSrc(thumb)
        setIsCached(cached)
      }
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.outputUrls, getCacheVersion(), task.id])

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
      draggable={task.status === 'completed'}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/task-id', task.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      className={`group bg-white rounded-xl border overflow-hidden cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg ${selected ? 'ring-2 ring-blue-400 border-blue-300' : statusColors[task.status]}`}
      style={{ contentVisibility: 'auto' as any, containIntrinsicSize: '10rem' as any }}
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          onToggleSelect()
        } else {
          onClick()
        }
      }}
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
          {task.status === 'completed' && thumbSrc && !thumbError && (
            <>
              <img
                src={thumbSrc}
                className="w-full h-full object-cover"
                loading="lazy"
                alt=""
                onError={() => {
                  // 远程图片失败，尝试用缓存
                  const url = task.outputUrls?.[0]
                  if (url && /^https?:\/\//i.test(url)) {
                    const cached = getCachedRemoteUrl(url)
                    if (cached && cached !== thumbSrc) {
                      setThumbSrc(cached)
                      setIsCached(true)
                      return
                    }
                  }
                  setThumbError(true)
                }}
              />
              {/* 来源标记 */}
              {thumbSrc && isCached && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-400 ring-1 ring-white" title="本地缓存" />
              )}
              {thumbSrc && !isCached && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-gray-300 ring-1 ring-white" title="远程加载" />
              )}
              {task.outputUrls.length > 1 && (
                <span className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                  {task.outputUrls.length}
                </span>
              )}
            </>
          )}
          {(task.status === 'completed' && (!thumbSrc || thumbError)) && (
            <div className="flex flex-col items-center gap-1 px-2">
              <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs text-gray-400">图片不可用</span>
            </div>
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
              className="flex-1 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors flex items-center justify-center"
              title="复用配置"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className="flex-1 py-1 rounded-lg bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors flex items-center justify-center"
              title="删除"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            {/* 移动到文件夹 */}
            <div className="relative flex-1" ref={folderPickerRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowFolderPicker((v) => !v)
                }}
                className="w-full py-1 rounded-lg bg-gray-100 text-gray-400 hover:bg-blue-50 hover:text-blue-500 transition-colors flex items-center justify-center"
                title="移动到文件夹"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </button>
              {showFolderPicker && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-36 bg-white rounded-xl border border-gray-200 shadow-lg py-1 z-50 max-h-40 overflow-y-auto animate-dropdown-up">
                  {folders.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-gray-400">暂无文件夹</div>
                  ) : (
                    folders.map((f) => (
                      <button
                        key={f.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          moveTasksToFolder([task.id], f.id)
                          setShowFolderPicker(false)
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        {f.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleSelect() }}
              className={`flex-1 py-1 rounded-lg transition-colors flex items-center justify-center ${
                selected
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-400 hover:bg-blue-50 hover:text-blue-500'
              }`}
              title={selected ? '取消选择' : '选择'}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
