import { useStore } from '../store'
import { hapticImpact } from '../lib/native'
import { isNative } from '../lib/platform'

const tabs = [
  { id: 'tasks', label: '任务', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
  { id: 'library', label: '图片库', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { id: 'generate', label: '生成', icon: '' },
  { id: 'stats', label: '统计', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id: 'settings', label: '设置', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z' },
]

export default function BottomNav() {
  const showSettings = useStore((s) => s.showSettings)
  const showStats = useStore((s) => s.showStats)
  const showPhotoLibrary = useStore((s) => s.showPhotoLibrary)
  const detailTaskId = useStore((s) => s.detailTaskId)
  const setShowSettings = useStore((s) => s.setShowSettings)
  const setShowStats = useStore((s) => s.setShowStats)
  const setShowPhotoLibrary = useStore((s) => s.setShowPhotoLibrary)
  const setDetailTaskId = useStore((s) => s.setDetailTaskId)

  // DetailModal 打开时隐藏 BottomNav，避免 z-index 层级冲突
  if (detailTaskId) return null

  // Android 端隐藏底边栏
  if (isNative()) return null

  // 从 store 派生当前活跃 Tab
  const activeTab = showSettings ? 'settings' : showStats ? 'stats' : showPhotoLibrary ? 'library' : 'tasks'

  const closeAllModals = () => {
    setShowSettings(false)
    setShowStats(false)
    setShowPhotoLibrary(false)
    setDetailTaskId(null)
  }

  const handleTabClick = (id: string) => {
    hapticImpact('light')
    switch (id) {
      case 'tasks':
        closeAllModals()
        window.scrollTo({ top: 0, behavior: 'smooth' })
        break
      case 'library':
        closeAllModals()
        setShowPhotoLibrary(true)
        break
      case 'generate':
        closeAllModals()
        const textarea = document.querySelector('textarea')
        textarea?.focus()
        break
      case 'stats':
        closeAllModals()
        setShowStats(true)
        break
      case 'settings':
        closeAllModals()
        setShowSettings(true)
        break
    }
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-2xl border-t border-gray-200/50"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {tabs.map((tab) => {
          const isGenerate = tab.id === 'generate'
          const isActive = activeTab === tab.id

          if (isGenerate) {
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className="relative -mt-5 flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/30 hover:scale-110 active:scale-95 transition-transform duration-200"
                title="生成图片"
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )
          }

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-all duration-200 active:scale-95 ${
                isActive ? 'text-blue-500' : 'text-gray-400'
              }`}
              title={tab.label}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive ? 2 : 1.5} d={tab.icon} />
              </svg>
              <span className={`text-[10px] ${isActive ? 'font-medium' : ''}`}>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
