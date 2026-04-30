import { useMemo } from 'react'
import { useStore } from '../store'
import Select from './Select'

export default function SearchBar() {
  const searchQuery = useStore((s) => s.searchQuery)
  const setSearchQuery = useStore((s) => s.setSearchQuery)
  const filterStatus = useStore((s) => s.filterStatus)
  const setFilterStatus = useStore((s) => s.setFilterStatus)
  const setShowFetchModal = useStore((s) => s.setShowFetchModal)
  const tasks = useStore((s) => s.tasks)
  const activeFolderId = useStore((s) => s.activeFolderId)
  const folders = useStore((s) => s.folders)

  const filteredCount = useMemo(() => {
    let sorted = [...tasks].sort((a, b) => b.createdAt - a.createdAt)
    if (activeFolderId === '_ungrouped') {
      const ids = new Set(folders.flatMap((f) => f.taskIds))
      sorted = sorted.filter((t) => !ids.has(t.id))
    } else if (activeFolderId) {
      const folder = folders.find((f) => f.id === activeFolderId)
      if (folder) {
        const idSet = new Set(folder.taskIds)
        sorted = sorted.filter((t) => idSet.has(t.id))
      }
    }
    const q = searchQuery.trim().toLowerCase()
    if (!q) return sorted.filter((t) => filterStatus === 'all' || t.status === filterStatus).length
    return sorted.filter((t) => {
      const matchStatus = filterStatus === 'all' || t.status === filterStatus
      if (!matchStatus) return false
      const prompt = (t.prompt || '').toLowerCase()
      const paramStr = JSON.stringify(t.params).toLowerCase()
      return prompt.includes(q) || paramStr.includes(q)
    }).length
  }, [tasks, searchQuery, filterStatus, activeFolderId, folders])

  return (
    <div className="mt-6 mb-4 flex gap-2 sm:gap-3">
      <div className="relative w-28 sm:w-36 flex-shrink-0 z-20">
        <Select
          value={filterStatus}
          onChange={(val) => setFilterStatus(val as any)}
          options={[
            { label: '全部状态', value: 'all' },
            { label: '已完成', value: 'completed' },
            { label: '进行中', value: 'in_progress' },
            { label: '失败', value: 'failed' },
          ]}
          className="px-4 py-2.5 min-h-[44px] rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
        />
      </div>
      <div className="relative flex-1 z-10">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          data-search-input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          type="text"
          placeholder="搜索提示词、参数... (按 / 聚焦)"
          className="w-full pl-10 pr-8 py-2.5 min-h-[44px] rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
            title="清除搜索"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <span className="hidden sm:block flex-shrink-0 text-xs text-gray-400 tabular-nums self-center">
        {filteredCount} 条
      </span>
      <button
        onClick={() => setShowFetchModal(true)}
        className="hidden sm:flex flex-shrink-0 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-500 hover:bg-gray-50 hover:text-blue-600 transition-colors items-center gap-1.5"
        title="拉取远程任务"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        拉取
      </button>
    </div>
  )
}
