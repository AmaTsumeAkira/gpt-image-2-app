import { useEffect, useState, useMemo } from 'react'
import { useStore, reuseConfig, removeTask, upscaleImage } from '../store'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'

export default function DetailModal() {
  const tasks = useStore((s) => s.tasks)
  const detailTaskId = useStore((s) => s.detailTaskId)
  const setDetailTaskId = useStore((s) => s.setDetailTaskId)
  const setLightboxImageUrl = useStore((s) => s.setLightboxImageUrl)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)
  const showToast = useStore((s) => s.showToast)

  const [imageIndex, setImageIndex] = useState(0)

  const task = useMemo(
    () => tasks.find((t) => t.id === detailTaskId) ?? null,
    [tasks, detailTaskId],
  )

  useCloseOnEscape(Boolean(task), () => setDetailTaskId(null))

  // Reset index when task changes
  useEffect(() => {
    setImageIndex(0)
  }, [detailTaskId])

  if (!task) return null

  const outputUrls = task.outputUrls || []
  const outputLen = outputUrls.length
  const currentImageUrl = outputUrls[imageIndex] || ''

  const formatTime = (ts: number | null) => {
    if (!ts) return ''
    return new Date(ts).toLocaleString('zh-CN')
  }

  const formatDuration = () => {
    if (task.elapsed == null) return null
    const seconds = Math.floor(task.elapsed / 1000)
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
    const ss = String(seconds % 60).padStart(2, '0')
    return `${mm}:${ss}`
  }

  const handleReuse = () => {
    reuseConfig(task)
    setDetailTaskId(null)
  }

  const handleDelete = () => {
    setDetailTaskId(null)
    setConfirmDialog({
      title: '删除记录',
      message: '确定要删除这条记录吗？',
      action: () => removeTask(task.id),
    })
  }

  const handleCopyError = async () => {
    const errorText = task.error || '生成失败'
    try {
      await navigator.clipboard.writeText(errorText)
      showToast('完整报错已复制', 'success')
    } catch {
      showToast('复制报错失败', 'error')
    }
  }

  const handleCopyPrompt = async () => {
    if (!task.prompt) return
    try {
      await navigator.clipboard.writeText(task.prompt)
      showToast('提示词已复制', 'success')
    } catch {
      showToast('复制提示词失败', 'error')
    }
  }

  const handleDownload = async (url: string, index: number) => {
    try {
      const resp = await fetch(url)
      const blob = await resp.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `gpt-image-2-${task.id.slice(-8)}-${index + 1}.${blob.type.split('/')[1] || 'png'}`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      showToast('下载失败', 'error')
    }
  }

  const handleUpscale = () => {
    const url = currentImageUrl || outputUrls[0]
    if (!url) return
    upscaleImage(url, task.prompt, task.params)
    setDetailTaskId(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setDetailTaskId(null)}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-md animate-overlay-in" />
      <div
        className="relative bg-white/90 backdrop-blur-xl border border-white/50 rounded-3xl shadow-[0_8px_40px_rgb(0,0,0,0.12)] max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col md:flex-row z-10 ring-1 ring-black/5 animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部关闭按钮（移动端） */}
        <div className="flex h-14 items-center justify-end px-4 md:hidden">
          <button
            onClick={() => setDetailTaskId(null)}
            className="p-1 rounded-full hover:bg-gray-100 transition text-gray-400"
            aria-label="关闭"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 左侧：图片 */}
        <div className="relative bg-gray-100 md:w-[480px] lg:w-[560px] flex-shrink-0 flex items-center justify-center min-h-[300px] md:min-h-[400px]">
          {task.status === 'completed' && currentImageUrl ? (
            <>
              <img
                src={currentImageUrl}
                className="max-w-full max-h-full object-contain cursor-pointer"
                onClick={() => setLightboxImageUrl(currentImageUrl, outputUrls)}
                alt="生成结果"
              />
              {outputLen > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setImageIndex((i) => (i - 1 + outputLen) % outputLen)
                    }}
                    className="w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="text-white text-xs bg-black/40 px-2 py-1 rounded-full">
                    {imageIndex + 1} / {outputLen}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setImageIndex((i) => (i + 1) % outputLen)
                    }}
                    className="w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
            </>
          ) : task.status === 'in_progress' || task.status === 'submitted' ? (
            <div className="flex flex-col items-center gap-3">
              <svg className="w-10 h-10 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm text-gray-400">生成中... {task.progress}%</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-gray-400">
              <svg className="w-10 h-10 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm">生成失败</span>
            </div>
          )}

          {/* 左上角参数标签 */}
          <div className="absolute top-3 left-3 flex flex-wrap gap-1">
            <span className="bg-black/40 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">
              {task.params.size} {task.params.resolution}
            </span>
            {task.params.quality !== 'auto' && (
              <span className="bg-black/40 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">
                {task.params.quality}
              </span>
            )}
          </div>
        </div>

        {/* 右侧：信息 */}
        <div className="flex-1 flex flex-col p-5 min-w-0 md:w-80 overflow-y-auto">
          {/* 桌面端关闭按钮 */}
          <div className="hidden md:flex justify-end mb-2">
            <button
              onClick={() => setDetailTaskId(null)}
              className="p-1 rounded-full hover:bg-gray-100 transition text-gray-400"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 提示词 */}
          <div className="mb-4">
            <h4 className="text-xs font-medium text-gray-400 mb-1">提示词</h4>
            <p className="text-sm text-gray-700 leading-relaxed cursor-pointer hover:text-blue-600 transition-colors" onClick={handleCopyPrompt} title="点击复制">
              {task.prompt || '(无提示词)'}
            </p>
          </div>

          {/* 合成参考图（DM-Fox 多图合成） */}
          {task.compositeInputUrl && (
            <div className="mb-4">
              <h4 className="text-xs font-medium text-gray-400 mb-1 flex items-center gap-1">
                合成参考图
                <span className="text-[10px] text-gray-300 font-normal">(多图合成)</span>
              </h4>
              <img
                src={task.compositeInputUrl}
                className="w-full max-h-32 rounded-lg object-contain border border-gray-200 bg-gray-50 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setLightboxImageUrl(task.compositeInputUrl!)}
                alt="合成参考图"
              />
            </div>
          )}

          {/* 优化后提示词（DM-Fox 同步 API 返回） */}
          {task.revisedPrompt && (
            <div className="mb-4">
              <h4 className="text-xs font-medium text-gray-400 mb-1 flex items-center gap-1">
                优化后的提示词
                <span className="text-[10px] text-gray-300 font-normal">(由模型自动优化)</span>
              </h4>
              <div className="p-2.5 bg-amber-50/50 border border-amber-100 rounded-lg">
                <p className="text-xs text-amber-800 leading-relaxed">{task.revisedPrompt}</p>
              </div>
            </div>
          )}

          {/* 参数 */}
          <div className="mb-4">
            <h4 className="text-xs font-medium text-gray-400 mb-1">参数</h4>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(task.params).map(([key, val]) => {
                if (val == null || val === '' || val === false) return null
                const labelMap: Record<string, string> = {
                  size: '尺寸', resolution: '分辨率', quality: '质量', background: '背景',
                  output_format: '格式', output_compression: '压缩', moderation: '审核', n: '数量',
                }
                const valueMap: Record<string, Record<string, string>> = {
                  size: { auto: '自动' },
                  quality: { auto: '自动', low: '低', medium: '中', high: '高' },
                  background: { auto: '自动', opaque: '不透明', transparent: '透明' },
                  moderation: { auto: '自动', low: '宽松' },
                }
                const label = labelMap[key] || key
                const displayVal = valueMap[key]?.[String(val)] ?? String(val)
                return (
                  <span key={key} className="bg-gray-100 text-gray-600 text-[11px] px-2 py-0.5 rounded-full">
                    {label}: {displayVal}
                  </span>
                )
              })}
            </div>
          </div>

          {/* 状态信息 */}
          <div className="mb-4 space-y-1 text-xs text-gray-400">
            <div className="flex justify-between">
              <span>状态</span>
              <span className={
                task.status === 'completed' ? 'text-green-500' :
                task.status === 'failed' ? 'text-red-500' :
                'text-blue-500'
              }>
                {task.status === 'completed' ? '已完成' :
                 task.status === 'failed' ? '失败' :
                 task.status === 'in_progress' ? '生成中' : '已提交'}
              </span>
            </div>
            {task.status !== 'failed' && formatDuration() && (
              <div className="flex justify-between">
                <span>耗时</span>
                <span className="font-mono">{formatDuration()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>时间</span>
              <span>{formatTime(task.createdAt)}</span>
            </div>
            {task.usage && (
              <div className="flex justify-between text-[10px] text-gray-300 pt-1 border-t border-gray-50 mt-1">
                <span>用量</span>
                <span className="font-mono">
                  {task.usage.input_tokens != null && `↑${task.usage.input_tokens}`}
                  {task.usage.input_tokens != null && task.usage.output_tokens != null && ' · '}
                  {task.usage.output_tokens != null && `↓${task.usage.output_tokens}`}
                  {task.usage.images != null && ` · ${task.usage.images}张`}
                </span>
              </div>
            )}
          </div>

          {/* 错误信息 */}
          {task.status === 'failed' && task.error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-red-700 break-words">{task.error}</p>
                  <button
                    onClick={handleCopyError}
                    className="text-xs text-red-400 hover:text-red-600 mt-1 transition-colors"
                  >
                    复制报错
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 输出图片列表 */}
          {task.status === 'completed' && outputUrls.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-medium text-gray-400 mb-2">输出 ({outputUrls.length}张)</h4>
              <div className="flex flex-wrap gap-2">
                {outputUrls.map((url, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={url}
                      className="w-14 h-14 rounded-lg object-cover border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => {
                        setImageIndex(idx)
                      }}
                      alt={`输出 ${idx + 1}`}
                    />
                    <button
                      onClick={() => handleDownload(url, idx)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-blue-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      title="下载"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-2 mt-auto border-t border-gray-100 pt-4">
            {task.status === 'completed' && outputUrls.length > 0 && (
              <button
                onClick={handleUpscale}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors"
                title="以更高分辨率重新生成"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
                放大
              </button>
            )}
            {task.status === 'completed' && currentImageUrl && (
              <button
                onClick={() => handleDownload(currentImageUrl, imageIndex)}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                title="下载当前图片"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                下载
              </button>
            )}
            <button
              onClick={handleReuse}
              className="flex-1 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              复用配置
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 rounded-xl text-sm font-medium text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
