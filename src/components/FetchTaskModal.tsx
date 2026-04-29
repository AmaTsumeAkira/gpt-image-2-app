import { useState } from 'react'
import { useStore, fetchRemoteTask } from '../store'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'

export default function FetchTaskModal() {
  const showFetchModal = useStore((s) => s.showFetchModal)
  const setShowFetchModal = useStore((s) => s.setShowFetchModal)
  const [taskIdInput, setTaskIdInput] = useState('')
  const [loading, setLoading] = useState(false)

  useCloseOnEscape(showFetchModal, () => setShowFetchModal(false))

  if (!showFetchModal) return null

  const handleFetch = async () => {
    if (!taskIdInput.trim()) return
    setLoading(true)
    try {
      await fetchRemoteTask(taskIdInput.trim())
      setTaskIdInput('')
      setShowFetchModal(false)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleFetch()
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-overlay-in"
        onClick={() => setShowFetchModal(false)}
      />
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/50 bg-white/95 p-5 shadow-2xl ring-1 ring-black/5 animate-modal-in">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            拉取远程任务
          </h3>
          <button
            onClick={() => setShowFetchModal(false)}
            className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label="关闭"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            输入任务 ID（task_id）从服务端拉取任务状态和生成结果
          </p>

          <label className="block">
            <span className="block text-xs text-gray-500 mb-1">Task ID</span>
            <input
              value={taskIdInput}
              onChange={(e) => setTaskIdInput(e.target.value)}
              onKeyDown={handleKeyDown}
              type="text"
              placeholder="例如：task_01KPTXXXXXXXXXXXXXXX"
              className="w-full rounded-xl border border-gray-200/70 bg-white/60 px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-blue-300 placeholder:text-gray-300"
              autoFocus
            />
          </label>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setShowFetchModal(false)}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleFetch}
              disabled={loading || !taskIdInput.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  查询中...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  拉取任务
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
