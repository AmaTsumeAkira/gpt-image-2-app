import { useMemo, useState, useEffect, useRef } from 'react'
import { useStore, reuseConfig, removeTask, removeTasks, moveTasksToFolder } from '../store'
import TaskCard from './TaskCard'

export default function TaskGrid() {
  const tasks = useStore((s) => s.tasks)
  const searchQuery = useStore((s) => s.searchQuery)
  const filterStatus = useStore((s) => s.filterStatus)
  const activeFolderId = useStore((s) => s.activeFolderId)
  const folders = useStore((s) => s.folders)
  const setDetailTaskId = useStore((s) => s.setDetailTaskId)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)
  const selectedTaskIds = useStore((s) => s.selectedTaskIds)
  const toggleTaskSelection = useStore((s) => s.toggleTaskSelection)
  const selectAllTasks = useStore((s) => s.selectAllTasks)
  const clearSelection = useStore((s) => s.clearSelection)
  const showToast = useStore((s) => s.showToast)

  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const folderPickerRef = useRef<HTMLDivElement>(null)

  const filteredTasks = useMemo(() => {
    let sorted = [...tasks].sort((a, b) => b.createdAt - a.createdAt)

    // 按文件夹筛选
    if (activeFolderId === '_ungrouped') {
      const allFolderTaskIds = new Set(folders.flatMap((f) => f.taskIds))
      sorted = sorted.filter((t) => !allFolderTaskIds.has(t.id))
    } else if (activeFolderId) {
      const folder = folders.find((f) => f.id === activeFolderId)
      if (folder) {
        const idSet = new Set(folder.taskIds)
        sorted = sorted.filter((t) => idSet.has(t.id))
      }
    }

    const q = searchQuery.trim().toLowerCase()
    return sorted.filter((t) => {
      const matchStatus = filterStatus === 'all' || t.status === filterStatus
      if (!matchStatus) return false

      if (!q) return true
      const prompt = (t.prompt || '').toLowerCase()
      const paramStr = JSON.stringify(t.params).toLowerCase()
      return prompt.includes(q) || paramStr.includes(q)
    })
  }, [tasks, searchQuery, filterStatus, activeFolderId, folders])

  const hasSelection = selectedTaskIds.size > 0

  // Escape 清空选择
  useEffect(() => {
    if (!hasSelection) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearSelection()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [hasSelection, clearSelection])

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

  const handleDelete = (taskId: string) => {
    setConfirmDialog({
      title: '删除记录',
      message: '确定要删除这条记录吗？',
      action: () => removeTask(taskId),
    })
  }

  const handleBatchDelete = () => {
    const count = selectedTaskIds.size
    setConfirmDialog({
      title: '批量删除',
      message: `确定要删除选中的 ${count} 条记录吗？此操作不可撤销。`,
      action: () => removeTasks(Array.from(selectedTaskIds)),
    })
  }

  const handleBatchDownload = async () => {
    let downloaded = 0
    for (const taskId of selectedTaskIds) {
      const task = tasks.find((t) => t.id === taskId)
      if (!task?.outputUrls?.length) continue
      for (let i = 0; i < task.outputUrls.length; i++) {
        try {
          const resp = await fetch(task.outputUrls[i])
          const blob = await resp.blob()
          const a = document.createElement('a')
          a.href = URL.createObjectURL(blob)
          a.download = `gpt-image-2-${task.id.slice(-8)}-${i + 1}.${blob.type.split('/')[1] || 'png'}`
          a.click()
          URL.revokeObjectURL(a.href)
          downloaded++
        } catch { /* skip failed */ }
      }
    }
    if (downloaded > 0) showToast(`已下载 ${downloaded} 张图片`, 'success')
    else showToast('没有可下载的图片', 'info')
  }

  const handleMoveToFolder = (folderId: string) => {
    moveTasksToFolder(Array.from(selectedTaskIds), folderId)
    setShowFolderPicker(false)
  }

  const isAllSelected = filteredTasks.length > 0 && filteredTasks.every((t) => selectedTaskIds.has(t.id))

  const handleSelectAll = () => {
    if (isAllSelected) {
      clearSelection()
    } else {
      selectAllTasks(filteredTasks.map((t) => t.id))
    }
  }

  if (!filteredTasks.length) {
    return (
      <div className="text-center py-16 text-gray-400">
        {searchQuery ? (
          <p className="text-sm">没有找到匹配的记录</p>
        ) : activeFolderId === '_ungrouped' ? (
          <p className="text-sm">所有图片都已归类</p>
        ) : activeFolderId ? (
          <p className="text-sm">此文件夹暂无图片，拖拽任务卡片到文件夹标签即可归类</p>
        ) : tasks.length === 0 ? (
          /* 首次使用引导 */
          <div className="max-w-sm mx-auto">
            <svg
              className="w-16 h-16 mx-auto mb-6 text-gray-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <h3 className="text-base font-semibold text-gray-600 mb-4">开始生成你的第一张图片</h3>
            <div className="space-y-3 text-left">
              {[
                { step: '1', title: '配置 API', desc: '点击右上角设置图标，填入 API Key' },
                { step: '2', title: '输入描述', desc: '在底部输入框中描述你想生成的图片' },
                { step: '3', title: '点击生成', desc: '按 Ctrl+Enter 或点击发送按钮，等待结果' },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50/80 border border-gray-100">
                  <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    {step}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-700">{title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm">输入提示词开始生成图片</p>
          </>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {filteredTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            selected={selectedTaskIds.has(task.id)}
            onClick={() => setDetailTaskId(task.id)}
            onReuse={() => reuseConfig(task)}
            onDelete={() => handleDelete(task.id)}
            onToggleSelect={() => toggleTaskSelection(task.id)}
          />
        ))}
      </div>

      {/* 浮动操作工具栏 */}
      {hasSelection && (
        <div className="fixed bottom-24 sm:bottom-28 left-1/2 -translate-x-1/2 z-30 animate-slide-up">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/80 backdrop-blur-2xl border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.1)] ring-1 ring-black/5">
            {/* 全选 / 取消 */}
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              title={isAllSelected ? '取消全选' : '全选当前列表'}
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                isAllSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300'
              }`}>
                {isAllSelected && (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              {selectedTaskIds.size}
            </button>

            <div className="w-px h-5 bg-gray-200" />

            {/* 移动到文件夹 */}
            <div className="relative" ref={folderPickerRef}>
              <button
                onClick={() => setShowFolderPicker((v) => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                title="移动到文件夹"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                移动
              </button>
              {showFolderPicker && (
                <div className="absolute bottom-full left-0 mb-2 w-44 bg-white rounded-xl border border-gray-200 shadow-lg py-1 animate-dropdown-up z-50 max-h-48 overflow-y-auto">
                  {folders.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-gray-400">暂无文件夹</div>
                  ) : (
                    folders.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => handleMoveToFolder(f.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        {f.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* 下载 */}
            <button
              onClick={handleBatchDownload}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              title="下载选中图片"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              下载
            </button>

            <div className="w-px h-5 bg-gray-200" />

            {/* 删除 */}
            <button
              onClick={handleBatchDelete}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
              title="删除选中"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              删除
            </button>
          </div>
        </div>
      )}
    </>
  )
}
