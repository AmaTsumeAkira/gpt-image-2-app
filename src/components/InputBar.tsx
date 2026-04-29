import { useRef, useEffect, useCallback, useState } from 'react'
import { useStore, submitTask, addImageFromFile } from '../store'
import ParamPanel from './ParamPanel'

/** 通用悬浮气泡提示 */
function ButtonTooltip({ visible, text }: { visible: boolean; text: string }) {
  if (!visible) return null
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none z-10 whitespace-nowrap">
      <div className="relative bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
      </div>
    </div>
  )
}

export default function InputBar() {
  const prompt = useStore((s) => s.prompt)
  const setPrompt = useStore((s) => s.setPrompt)
  const inputImages = useStore((s) => s.inputImages)
  const settings = useStore((s) => s.settings)
  const setShowSettings = useStore((s) => s.setShowSettings)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const prevHeightRef = useRef(42)

  const [submitHover, setSubmitHover] = useState(false)
  const [attachHover, setAttachHover] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showMobileParams, setShowMobileParams] = useState(false)
  const dragCounter = useRef(0)

  const canSubmit = (prompt.trim() || inputImages.length) && settings.apiKey
  const atImageLimit = inputImages.length >= 16

  const handleFiles = async (files: FileList | File[]) => {
    try {
      for (const file of Array.from(files)) {
        if (file.type.startsWith('image/')) {
          await addImageFromFile(file)
        }
      }
    } catch (err) {
      useStore.getState().showToast(`图片添加失败：${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }

  const handleFilesRef = useRef(handleFiles)
  handleFilesRef.current = handleFiles

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await handleFilesRef.current(e.target.files || [])
    e.target.value = ''
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      submitTask()
    }
  }

  // 粘贴图片
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      const imageFiles: File[] = []
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) imageFiles.push(file)
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault()
        handleFilesRef.current(imageFiles)
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [])

  // 拖拽图片
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault(); e.stopPropagation()
      dragCounter.current++
      if (e.dataTransfer?.types.includes('Files')) setIsDragging(true)
    }
    const handleDragOver = (e: DragEvent) => { e.preventDefault(); e.stopPropagation() }
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault(); e.stopPropagation()
      dragCounter.current--
      if (dragCounter.current === 0) setIsDragging(false)
    }
    const handleDrop = (e: DragEvent) => {
      e.preventDefault(); e.stopPropagation()
      dragCounter.current = 0
      setIsDragging(false)
      const files = e.dataTransfer?.files
      if (files && files.length > 0) handleFilesRef.current(files)
    }
    document.addEventListener('dragenter', handleDragEnter)
    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('dragleave', handleDragLeave)
    document.addEventListener('drop', handleDrop)
    return () => {
      document.removeEventListener('dragenter', handleDragEnter)
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('dragleave', handleDragLeave)
      document.removeEventListener('drop', handleDrop)
    }
  }, [])

  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.transition = 'none'
    el.style.height = '0'
    el.style.overflowY = 'hidden'
    const scrollH = el.scrollHeight
    const minH = 42
    const maxH = Math.max(window.innerHeight * 0.3, 80)
    const desired = Math.max(scrollH, minH)
    const targetH = desired > maxH ? maxH : desired
    el.style.height = prevHeightRef.current + 'px'
    void el.offsetHeight
    el.style.transition = 'height 150ms ease, border-color 200ms, box-shadow 200ms'
    el.style.height = targetH + 'px'
    el.style.overflowY = desired > maxH ? 'auto' : 'hidden'
    prevHeightRef.current = targetH
  }, [])

  useEffect(() => { adjustTextareaHeight() }, [prompt, adjustTextareaHeight])
  useEffect(() => {
    window.addEventListener('resize', adjustTextareaHeight)
    return () => window.removeEventListener('resize', adjustTextareaHeight)
  }, [adjustTextareaHeight])

  return (
    <>
      {/* 拖拽遮罩 */}
      {isDragging && (
        <div className="fixed inset-0 z-[100] bg-white/60 backdrop-blur-md flex flex-col items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-4 p-8 rounded-3xl">
            <div className="w-20 h-20 rounded-full border-2 border-dashed flex items-center justify-center bg-blue-50 border-blue-400">
              <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-gray-700">释放以添加参考图</p>
          </div>
        </div>
      )}

      <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 w-full max-w-4xl px-3 sm:px-4 transition-all duration-300">
        <div className="bg-white/70 backdrop-blur-2xl border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-2xl sm:rounded-3xl p-3 sm:p-4 ring-1 ring-black/5">
          <div className="flex items-end gap-3">
            {/* 输入框 */}
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="描述你想生成的图片... (Ctrl+Enter 快速生成)"
              className="flex-1 px-4 py-3 rounded-2xl border border-gray-200/60 bg-white/50 text-sm focus:outline-none leading-relaxed resize-none shadow-sm transition-[border-color,box-shadow] duration-200"
            />

            <div className="flex items-center gap-1.5 flex-shrink-0 pb-0.5">
              {/* 参数面板（仅移动端） */}
              <button
                onClick={() => setShowMobileParams((v) => !v)}
                className={`p-2 rounded-xl transition-all shadow-sm lg:hidden ${
                  showMobileParams
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-500 hover:shadow'
                }`}
                title="生成参数"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </button>
              {/* 添加参考图 */}
              <div
                className="relative"
                onMouseEnter={() => setAttachHover(true)}
                onMouseLeave={() => setAttachHover(false)}
              >
                <ButtonTooltip visible={atImageLimit && attachHover} text="已达上限 16 张" />
                <button
                  onClick={() => !atImageLimit && fileInputRef.current?.click()}
                  className={`p-2 rounded-xl transition-all shadow-sm ${
                    atImageLimit
                      ? 'bg-gray-200 text-gray-300 cursor-not-allowed'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-500 hover:shadow'
                  }`}
                  title="添加参考图"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>
              </div>
              {/* 提交生成 */}
              <div
                className="relative"
                onMouseEnter={() => setSubmitHover(true)}
                onMouseLeave={() => setSubmitHover(false)}
              >
                <ButtonTooltip visible={!settings.apiKey && submitHover} text="尚未完成 API 配置，请在右上角设置中进行" />
                <button
                  onClick={() => (settings.apiKey ? submitTask() : setShowSettings(true))}
                  disabled={settings.apiKey ? !canSubmit : false}
                  className={`p-2 rounded-xl transition-all shadow-sm hover:shadow ${
                    !settings.apiKey
                      ? 'bg-gray-300 text-white cursor-pointer'
                      : 'bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
                  title={settings.apiKey ? `生成 (Ctrl+Enter) · ${settings.provider === 'dmfox' ? '同步' : '异步'}` : '请先配置 API'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} />
        </div>
      </div>

      {/* 移动端参数面板抽屉 */}
      {showMobileParams && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm animate-overlay-in"
            onClick={() => setShowMobileParams(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl rounded-t-3xl shadow-2xl border-t border-gray-200 max-h-[70vh] overflow-y-auto animate-slide-up p-5 pb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">生成参数</h3>
              <button
                onClick={() => setShowMobileParams(false)}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            <ParamPanel />
          </div>
        </div>
      )}
    </>
  )
}
