import { useEffect } from 'react'
import { initStore } from './store'
import { useStore } from './store'
import { normalizeBaseUrl } from './lib/api'
import Header from './components/Header'
import ProviderSwitcher from './components/ProviderSwitcher'
import SearchBar from './components/SearchBar'
import TaskGrid from './components/TaskGrid'
import InputBar from './components/InputBar'
import ParamPanel from './components/ParamPanel'
import DetailModal from './components/DetailModal'
import Lightbox from './components/Lightbox'
import SettingsModal from './components/SettingsModal'
import FetchTaskModal from './components/FetchTaskModal'
import PhotoLibraryModal from './components/PhotoLibraryModal'
import ConfirmDialog from './components/ConfirmDialog'
import Toast from './components/Toast'

export default function App() {
  const setSettings = useStore((s) => s.setSettings)

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

    initStore()
  }, [setSettings])

  return (
    <>
      <Header />
      <div className="max-w-7xl mx-auto px-4 pb-48">
        <div className="flex gap-6 mt-4">
          {/* 左侧参数面板（桌面端显示） */}
          <aside className="hidden lg:block w-72 xl:w-80 flex-shrink-0">
            <div className="sticky top-20 bg-white rounded-2xl border border-gray-200/60 p-4 shadow-sm max-h-[calc(100vh-6rem)] overflow-y-auto">
              <ParamPanel />
            </div>
          </aside>
          {/* 右侧主区域 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <ProviderSwitcher />
            </div>
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
      <ConfirmDialog />
      <Toast />
    </>
  )
}
