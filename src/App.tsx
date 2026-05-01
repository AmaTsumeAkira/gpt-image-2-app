import { useEffect, useCallback, useState } from 'react'
import { initStore } from './store'
import { useStore } from './store'
import { normalizeBaseUrl } from './lib/api'
import { isNative } from './lib/platform'
import { usePullToRefresh } from './hooks/usePullToRefresh'
import { setStatusBarStyle, setStatusBarColor, onNetworkChange, onAppStateChange } from './lib/native'
import { resumeInProgressTasks } from './store'
import Header from './components/Header'
import FolderBar from './components/FolderBar'
import SearchBar from './components/SearchBar'
import TaskGrid from './components/TaskGrid'
import InputBar from './components/InputBar'
import ParamPanel from './components/ParamPanel'
import DetailModal from './components/DetailModal'
import Lightbox from './components/Lightbox'
import SettingsModal from './components/SettingsModal'
import FetchTaskModal from './components/FetchTaskModal'
import PhotoLibraryModal from './components/PhotoLibraryModal'
import StatsModal from './components/StatsModal'
import DbManageModal from './components/DbManageModal'
import MaskHelpModal from './components/MaskHelpModal'
import MaskEditor from './components/MaskEditor'
import ConfirmDialog from './components/ConfirmDialog'
import Toast from './components/Toast'
import BottomNav from './components/BottomNav'
import UpdateBanner from './components/UpdateBanner'

export default function App() {
  const setSettings = useStore((s) => s.setSettings)
  const showToast = useStore((s) => s.showToast)
  const refreshTasks = useCallback(async () => {
    await initStore()
    showToast('已刷新', 'success')
  }, [showToast])
  const { pullDistance, refreshing, onTouchStart, onTouchMove, onTouchEnd } = usePullToRefresh(refreshTasks)
  const [offline, setOffline] = useState(false)

  // 状态栏 + 网络监听 + 生命周期
  useEffect(() => {
    if (isNative()) {
      setStatusBarStyle(false)
      setStatusBarColor('#ffffff')
    }
    const cleanupNet = onNetworkChange((connected) => {
      setOffline(!connected)
      if (!connected) showToast('网络已断开', 'error')
      else showToast('网络已恢复', 'success')
    })
    // APP 回到前台时恢复中断的任务
    const cleanupApp = onAppStateChange(({ isActive }) => {
      if (isActive) resumeInProgressTasks()
    })
    return () => { cleanupNet(); cleanupApp() }
  }, [])

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const nextSettings: { baseUrl?: string; apiKey?: string } = {}

    const apiUrlParam = searchParams.get('apiUrl')
    if (apiUrlParam !== null) {
      nextSettings.baseUrl = normalizeBaseUrl(apiUrlParam.trim())
    }

    const apiKeyParam = searchParams.get('apiKey')
    if (apiKeyParam !== null) {
      nextSettings.apiKey = apiKeyParam.trim()
    }

    if (Object.keys(nextSettings).length > 0) {
      setSettings(nextSettings)

      searchParams.delete('apiUrl')
      searchParams.delete('apiKey')

      const nextSearch = searchParams.toString()
      const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`
      window.history.replaceState(null, '', nextUrl)
    }

    initStore().catch(() => {})
  }, [setSettings])

  // 全局键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略输入框内的按键
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      if (e.key === '/') {
        e.preventDefault()
        const searchInput = document.querySelector('[data-search-input]') as HTMLInputElement
        searchInput?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <>
      <Header />
      <UpdateBanner />
      {/* 离线提示 */}
      {offline && (
        <div className="fixed top-14 left-0 right-0 z-50 bg-red-500 text-white text-center py-1.5 text-xs font-medium" style={{ top: 'calc(3.5rem + var(--safe-top))' }}>
          网络已断开，部分功能不可用
        </div>
      )}
      {/* 下拉刷新指示器 */}
      {pullDistance > 0 && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center transition-all duration-200"
          style={{ transform: `translateX(-50%) translateY(${pullDistance - 40}px)` }}>
          <div className={`w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}>
            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d={refreshing
                  ? "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  : "M19 14l-7 7m0 0l-7-7m7 7V3"} />
            </svg>
          </div>
        </div>
      )}
      <div className="px-4 sm:px-6 pb-48"
        style={{ paddingBottom: 'calc(12rem + var(--safe-bottom))' }}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <div className="flex gap-4 sm:gap-6 mt-4">
          {/* 左侧参数面板（桌面端显示） */}
          <aside className="hidden lg:block w-72 xl:w-80 flex-shrink-0">
            <div className="sticky top-20 bg-white rounded-2xl border border-gray-200/60 p-4 shadow-sm max-h-[calc(100vh-6rem)] overflow-y-auto">
              <ParamPanel />
            </div>
          </aside>
          {/* 右侧主区域 */}
          <div className="flex-1 min-w-0">
            <FolderBar />
            <SearchBar />
            <TaskGrid />
          </div>
        </div>
      </div>
      <InputBar />
      <DetailModal />
      <Lightbox />
      <SettingsModal />
      <FetchTaskModal />
      <PhotoLibraryModal />
      <StatsModal />
      <MaskEditor />
      <MaskHelpModal />
      <DbManageModal />
      <ConfirmDialog />
      <Toast />
      <BottomNav />
    </>
  )
}
