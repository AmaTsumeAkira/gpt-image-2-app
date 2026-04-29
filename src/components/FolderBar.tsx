import { useState, useRef, useEffect } from 'react'
import { useStore, moveTasksToFolder } from '../store'
import type { Folder } from '../types'

export default function FolderBar() {
  const folders = useStore((s) => s.folders)
  const activeFolderId = useStore((s) => s.activeFolderId)
  const setActiveFolderId = useStore((s) => s.setActiveFolderId)
  const setFolders = useStore((s) => s.setFolders)
  const tasks = useStore((s) => s.tasks)
  const selectedTaskIds = useStore((s) => s.selectedTaskIds)
  const showToast = useStore((s) => s.showToast)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createName, setCreateName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const createInputRef = useRef<HTMLInputElement>(null)

  const countInFolder = (f: Folder) =>
    f.taskIds.filter((id) => tasks.some((t) => t.id === id)).length

  const allFolderTaskIds = new Set(folders.flatMap((f) => f.taskIds))
  const ungroupedCount = tasks.filter((t) => !allFolderTaskIds.has(t.id)).length

  useEffect(() => {
    if (creating) createInputRef.current?.focus()
  }, [creating])

  const handleCreate = () => {
    const name = createName.trim()
    if (!name) { setCreating(false); setCreateName(''); return }
    const folder: Folder = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36),
      name,
      taskIds: [],
      createdAt: Date.now(),
    }
    setFolders([folder, ...folders])
    setCreating(false)
    setCreateName('')
    showToast('文件夹已创建', 'success')
  }

  const handleRename = (f: Folder) => {
    setEditingId(f.id)
    setEditName(f.name)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const commitRename = (f: Folder) => {
    const name = editName.trim()
    if (!name) { setEditingId(null); return }
    setFolders(folders.map((x) => (x.id === f.id ? { ...x, name } : x)))
    setEditingId(null)
  }

  const handleDelete = (f: Folder) => {
    setConfirmDialog({
      title: '删除文件夹',
      message: `确定要删除文件夹「${f.name}」吗？图片不会被删除。`,
      action: () => {
        const remaining = folders.filter((x) => x.id !== f.id)
        setFolders(remaining)
        if (activeFolderId === f.id) setActiveFolderId(null)
        showToast('文件夹已删除', 'info')
      },
    })
  }

  const handleDrop = (e: React.DragEvent, folderId: string) => {
    const taskId = e.dataTransfer.getData('text/task-id')
    if (!taskId) return
    // 如果拖拽的任务在选中列表中，则移动所有选中任务
    if (selectedTaskIds.size > 0 && selectedTaskIds.has(taskId)) {
      moveTasksToFolder(Array.from(selectedTaskIds), folderId)
    } else {
      setFolders(
        folders.map((f) => {
          if (f.id === folderId && !f.taskIds.includes(taskId)) {
            return { ...f, taskIds: [...f.taskIds, taskId] }
          }
          return { ...f, taskIds: f.taskIds.filter((id) => id !== taskId) }
        }),
      )
      showToast('已移动到文件夹', 'success')
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
      {/* 所有图片 */}
      <button
        onClick={() => setActiveFolderId(null)}
        className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
          activeFolderId === null
            ? 'bg-gray-800 text-white shadow-sm'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        所有图片
      </button>

      {/* 未分组 */}
      <button
        onClick={() => setActiveFolderId('_ungrouped')}
        className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
          activeFolderId === '_ungrouped'
            ? 'bg-orange-500 text-white shadow-sm'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        未分组
        <span className={`text-[10px] ml-1 ${activeFolderId === '_ungrouped' ? 'text-orange-200' : 'text-gray-400'}`}>
          {ungroupedCount}
        </span>
      </button>

      {/* 文件夹列表 */}
      {folders.map((f) => (
        <div
          key={f.id}
          className={`group flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-default ${
            activeFolderId === f.id
              ? 'bg-blue-500 text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          onDrop={(e) => handleDrop(e, f.id)}
          onDragOver={handleDragOver}
          onClick={() => setActiveFolderId(f.id)}
        >
          {editingId === f.id ? (
            <input
              ref={inputRef}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => commitRename(f)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename(f)
                if (e.key === 'Escape') setEditingId(null)
              }}
              className="w-16 bg-transparent outline-none border-b border-current text-xs"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span onDoubleClick={() => handleRename(f)}>{f.name}</span>
          )}
          <span className={`text-[10px] ${activeFolderId === f.id ? 'text-blue-200' : 'text-gray-400'}`}>
            {countInFolder(f)}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(f) }}
            className={`p-0.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-black/10 transition-opacity ${
              activeFolderId === f.id ? 'text-blue-200' : 'text-gray-400'
            }`}
            title="删除文件夹"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}

      {/* 新建 */}
      {creating ? (
        <div className="flex-shrink-0 flex items-center gap-1">
          <input
            ref={createInputRef}
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            onBlur={handleCreate}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
              if (e.key === 'Escape') { setCreating(false); setCreateName('') }
            }}
            placeholder="文件夹名称"
            className="w-24 px-2 py-1 rounded-lg border border-blue-300 bg-white text-xs outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="flex-shrink-0 w-7 h-7 rounded-lg bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-all flex items-center justify-center"
          title="新建文件夹"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}
    </div>
  )
}
