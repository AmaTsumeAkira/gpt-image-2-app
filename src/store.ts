import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppSettings, TaskParams, InputImage, TaskRecord, PhotoLibraryImage, Provider, Folder } from './types'
import { DEFAULT_SETTINGS, DEFAULT_PARAMS, PROVIDER_CONFIG } from './types'
import { submitGeneration, submitGenerationSync, queryTask, batchQueryTasks, uploadImage, fetchImageAsDataUrl, compressImage } from './lib/api'
import { hapticImpact, hapticNotification } from './lib/native'
import { notifyTaskComplete } from './lib/native'
import { normalizeImageSize } from './lib/size'
import { saveTasks, loadTasks, clearTasks, clearAllIndexedDB, migrateFromLocalStorage, saveCacheMap, loadCacheMap } from './lib/imageStore'
import { saveThumbCache, loadThumbCache } from './lib/imageStore'
import { compositeImages } from './lib/composite'

/** 判断是否为网络/超时错误（可重试） */
function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true
  if (err instanceof DOMException && err.name === 'AbortError') return true
  const msg = err instanceof Error ? err.message : String(err)
  return /网络|network|fetch|abort|timeout|Failed|ECONNREFUSED|ENETUNREACH/i.test(msg)
}

// ===== 简单的内存 image cache =====
const imageCache = new Map<string, string>()

export function getCachedImage(id: string): string | undefined {
  return imageCache.get(id)
}

export function setCachedImage(id: string, dataUrl: string) {
  imageCache.set(id, dataUrl)
}

// ===== 远程图片缓存（APIMart URL → dataUrl，持久化到 IndexedDB） =====
const remoteImageCache = new Map<string, string>()
let _cacheVersion = 0

export function getCachedRemoteUrl(url: string): string | undefined {
  return remoteImageCache.get(url)
}

export function getCacheVersion(): number {
  return _cacheVersion
}

// ===== 缩略图缓存 =====
const thumbCache = new Map<string, string>()

/** 生成 JPEG 缩略图（最大 256px），结果缓存在内存中 */
export function getThumbnail(dataUrl: string): Promise<string> {
  if (thumbCache.has(dataUrl)) return Promise.resolve(thumbCache.get(dataUrl)!)

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const MAX = 320
      const scale = Math.min(MAX / img.naturalWidth, MAX / img.naturalHeight, 1)
      const w = Math.round(img.naturalWidth * scale)
      const h = Math.round(img.naturalHeight * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      const thumb = canvas.toDataURL('image/jpeg', 0.7)
      thumbCache.set(dataUrl, thumb)
      // 异步持久化到 IndexedDB
      saveThumbCache(Array.from(thumbCache.entries())).catch(() => {})
      resolve(thumb)
    }
    img.onerror = () => resolve(dataUrl) // fallback 原图
    img.src = dataUrl
  })
}

/** 从 IndexedDB 恢复缩略图缓存 */
export async function initThumbCache() {
  try {
    const entries = await loadThumbCache()
    for (const [key, thumb] of entries) {
      thumbCache.set(key, thumb)
    }
  } catch {
    /* ignore */
  }
}

export async function initRemoteImageCache() {
  const entries = await loadCacheMap()
  for (const [url, dataUrl] of entries) {
    remoteImageCache.set(url, dataUrl)
  }
}

/** 扫描所有任务，下载远程图片并缓存到 IndexedDB */
export async function cacheAllRemoteImages(
  onProgress?: (done: number, total: number) => void,
): Promise<{ cached: number; total: number }> {
  const { tasks, showToast } = useStore.getState()
  // 统计需要下载的图片总数
  const allUrls: string[] = []
  for (const task of tasks) {
    for (const url of task.outputUrls) {
      if (typeof url === 'string' && /^https?:\/\//i.test(url) && !remoteImageCache.has(url)) {
        allUrls.push(url)
      }
    }
  }
  if (allUrls.length === 0) return { cached: 0, total: 0 }

  onProgress?.(0, allUrls.length)
  let count = 0
  for (const url of allUrls) {
    try {
      // 用 Image + Canvas 绕过 CORS 限制（<img> 可跨域加载）
      const dataUrl = await imageToDataUrl(url)
      remoteImageCache.set(url, dataUrl)
      count++
    } catch {
      /* skip */
    }
    onProgress?.(count, allUrls.length)
  }
  if (count > 0) {
    await saveCacheMap(Array.from(remoteImageCache.entries()))
    _cacheVersion++
  }
  // 触发布局重绘（用当前最新 tasks 创建新引用）
  const currentTasks = useStore.getState().tasks
  useStore.getState().setTasks([...currentTasks])
  return { cached: count, total: allUrls.length }
}

/** 用 Image + Canvas 或 fetch + Blob 下载图片为 data URL */
function imageToDataUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // 优先用 Image + Canvas（如果服务器有 CORS 头）
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      } catch {
        // Canvas 被污染，回退到 fetch 方式
        fetchAsDataUrl(url).then(resolve, reject)
      }
    }
    img.onerror = () => fetchAsDataUrl(url).then(resolve, reject)
    img.src = url
  })
}

/** fetch + Blob + FileReader 下载图片（需要服务器有 CORS 头） */
async function fetchAsDataUrl(url: string): Promise<string> {
  const resp = await fetch(url, { cache: 'no-store' })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const blob = await resp.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/** 删除所有失败状态的任务 */
export function clearFailedTasks() {
  const { tasks, setTasks, folders, setFolders, showToast } = useStore.getState()
  const failedIds = new Set(tasks.filter((t) => t.status === 'failed').map((t) => t.id))
  if (failedIds.size === 0) {
    showToast('没有需要清理的失败记录', 'info')
    return
  }
  const remaining = tasks.filter((t) => !failedIds.has(t.id))
  setTasks(remaining)
  saveTasks(remaining.slice(0, 200)).catch(() => {})
  // 从所有文件夹中移除已删除任务的引用
  if (folders.some((f) => f.taskIds.some((id) => failedIds.has(id)))) {
    setFolders(folders.map((f) => ({ ...f, taskIds: f.taskIds.filter((id) => !failedIds.has(id)) })))
  }
  showToast(`已清理 ${failedIds.size} 条失败记录`, 'success')
}

/** 获取缓存统计信息 */
export function getCacheStats() {
  const entries = Array.from(remoteImageCache.entries())
  let totalBytes = 0
  for (const [, dataUrl] of entries) {
    totalBytes += dataUrl.length * 2 // UTF-16 → 字节估算
  }
  return {
    count: entries.length,
    bytes: totalBytes,
    urls: entries.map(([url]) => url),
  }
}

/** 清理失效的缓存图片（远程 URL 已无法访问的） */
export async function pruneExpiredCache(): Promise<number> {
  let removed = 0
  for (const [url, dataUrl] of remoteImageCache) {
    // 跳过 data URL，只检查远程 URL
    if (!/^https?:\/\//i.test(url)) continue
    try {
      const resp = await fetch(url, { method: 'HEAD', cache: 'no-store' })
      if (!resp.ok) {
        remoteImageCache.delete(url)
        removed++
      }
    } catch {
      remoteImageCache.delete(url)
      removed++
    }
  }
  if (removed > 0) {
    await saveCacheMap(Array.from(remoteImageCache.entries()))
    _cacheVersion++
    const currentTasks = useStore.getState().tasks
    useStore.getState().setTasks([...currentTasks])
  }
  return removed
}

/** 清理重复的缓存图片（内容完全相同的 data URL） */
export async function dedupCache(): Promise<number> {
  const seen = new Map<string, string>() // dataUrl hash → first url
  let removed = 0
  for (const [url, dataUrl] of remoteImageCache) {
    // 用 dataUrl 的前 200 字符 + 长度作为指纹
    const fingerprint = `${dataUrl.slice(0, 200)}:${dataUrl.length}`
    if (seen.has(fingerprint)) {
      remoteImageCache.delete(url)
      removed++
    } else {
      seen.set(fingerprint, url)
    }
  }
  if (removed > 0) {
    await saveCacheMap(Array.from(remoteImageCache.entries()))
    _cacheVersion++
    const currentTasks = useStore.getState().tasks
    useStore.getState().setTasks([...currentTasks])
  }
  return removed
}

/** 清理已删除任务对应的远程图片缓存 */
export async function cleanupDeletedTaskCache(): Promise<number> {
  const { tasks } = useStore.getState()
  // 收集所有当前任务的 outputUrls
  const activeUrls = new Set<string>()
  for (const t of tasks) {
    for (const url of t.outputUrls) {
      if (typeof url === 'string') activeUrls.add(url)
    }
  }
  let removed = 0
  for (const [url] of remoteImageCache) {
    if (/^https?:\/\//i.test(url) && !activeUrls.has(url)) {
      remoteImageCache.delete(url)
      removed++
    }
  }
  if (removed > 0) {
    await saveCacheMap(Array.from(remoteImageCache.entries()))
    _cacheVersion++
    useStore.getState().setTasks([...useStore.getState().tasks])
  }
  return removed
}

// ===== 使用统计 =====

export interface TaskStats {
  total: number
  completed: number
  failed: number
  inProgress: number
  /** 按供应商分组的统计 */
  byProvider: Record<string, {
    total: number
    completed: number
    elapsedMs: number
    images: number
  }>
  totalImages: number
  totalElapsedMs: number
  /** 今日统计 */
  today: { total: number; completed: number }
  /** usage 汇总 */
  usage: { inputTokens: number; outputTokens: number; images: number }
}

export function getTaskStats(): TaskStats {
  const { tasks } = useStore.getState()
  const now = Date.now()
  const todayStart = new Date().setHours(0, 0, 0, 0)

  const stats: TaskStats = {
    total: tasks.length,
    completed: 0,
    failed: 0,
    inProgress: 0,
    byProvider: {},
    totalImages: 0,
    totalElapsedMs: 0,
    today: { total: 0, completed: 0 },
    usage: { inputTokens: 0, outputTokens: 0, images: 0 },
  }

  for (const t of tasks) {
    if (t.status === 'completed') stats.completed++
    else if (t.status === 'failed') stats.failed++
    else if (t.status === 'in_progress' || t.status === 'submitted') stats.inProgress++

    // 按供应商
    const prov = t.provider || 'unknown'
    if (!stats.byProvider[prov]) {
      stats.byProvider[prov] = { total: 0, completed: 0, elapsedMs: 0, images: 0 }
    }
    stats.byProvider[prov].total++
    if (t.status === 'completed') {
      stats.byProvider[prov].completed++
      if (t.elapsed != null) {
        stats.byProvider[prov].elapsedMs += t.elapsed
        stats.totalElapsedMs += t.elapsed
      }
      const n = t.outputUrls.length
      stats.byProvider[prov].images += n
      stats.totalImages += n
    }

    // 今日
    if (t.createdAt >= todayStart) {
      stats.today.total++
      if (t.status === 'completed') stats.today.completed++
    }

    // usage
    if (t.usage) {
      stats.usage.inputTokens += t.usage.input_tokens ?? 0
      stats.usage.outputTokens += t.usage.output_tokens ?? 0
      stats.usage.images += t.usage.images ?? 0
    }
  }

  return stats
}

// ===== Store 类型 =====

interface AppState {
  // 设置
  settings: AppSettings
  setSettings: (s: Partial<AppSettings>) => void

  // 输入
  prompt: string
  setPrompt: (p: string) => void
  inputImages: InputImage[]
  addInputImage: (img: InputImage) => void
  removeInputImage: (idx: number) => void
  clearInputImages: () => void
  setInputImages: (imgs: InputImage[]) => void

  // 遮罩图（局部重绘）
  maskImage: InputImage | null
  setMaskImage: (img: InputImage | null) => void
  clearMaskImage: () => void

  // 参数
  params: TaskParams
  setParams: (p: Partial<TaskParams>) => void

  // 任务列表
  tasks: TaskRecord[]
  setTasks: (t: TaskRecord[]) => void

  // 文件夹
  folders: Folder[]
  activeFolderId: string | null
  setFolders: (f: Folder[]) => void
  setActiveFolderId: (id: string | null) => void

  // 多选
  selectedTaskIds: Set<string>
  toggleTaskSelection: (id: string) => void
  selectAllTasks: (ids: string[]) => void
  clearSelection: () => void

  // 搜索和筛选
  searchQuery: string
  setSearchQuery: (q: string) => void
  filterStatus: 'all' | 'completed' | 'in_progress' | 'failed'
  setFilterStatus: (status: AppState['filterStatus']) => void

  // UI
  detailTaskId: string | null
  setDetailTaskId: (id: string | null) => void
  lightboxImageUrl: string | null
  lightboxImageList: string[]
  setLightboxImageUrl: (url: string | null, list?: string[]) => void
  showSettings: boolean
  setShowSettings: (v: boolean) => void
  showFetchModal: boolean
  setShowFetchModal: (v: boolean) => void
  showStats: boolean
  setShowStats: (v: boolean) => void
  showDbManage: boolean
  setShowDbManage: (v: boolean) => void
  showMaskHelp: boolean
  setShowMaskHelp: (v: boolean) => void
  showMaskEditor: boolean
  setShowMaskEditor: (v: boolean) => void

  // Toast
  toast: { message: string; type: 'info' | 'success' | 'error'; action?: { label: string; onClick: () => void } } | null
  showToast: (message: string, type?: 'info' | 'success' | 'error', action?: { label: string; onClick: () => void }) => void

  // Confirm dialog
  confirmDialog: {
    title: string
    message: string
    action: () => void
    variant?: 'destructive' | 'primary'
  } | null
  setConfirmDialog: (d: AppState['confirmDialog']) => void

  // Photo library
  photoLibrary: PhotoLibraryImage[]
  setPhotoLibrary: (lib: PhotoLibraryImage[]) => void
  addPhotoLibraryImage: (img: PhotoLibraryImage) => void
  removePhotoLibraryImage: (id: string) => void
  showPhotoLibrary: boolean
  setShowPhotoLibrary: (v: boolean) => void
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Settings
      settings: { ...DEFAULT_SETTINGS },
      setSettings: (s) =>
        set((st) => {
          const next = { ...st.settings, ...s }
          // 切换供应商时自动更新 baseUrl 和 model，并独立保存/恢复 API Key
          if (s.provider && s.provider !== st.settings.provider) {
            const cfg = PROVIDER_CONFIG[s.provider]

            // 把当前 apiKey 存到旧供应商的专用字段
            if (st.settings.provider === 'apimart') {
              next.apimartApiKey = st.settings.apiKey
            } else if (st.settings.provider === 'dmfox') {
              next.dmfoxApiKey = st.settings.apiKey
            }

            // 恢复新供应商上次保存的 Key（如果没有则清空，避免混用）
            if (s.provider === 'apimart') {
              next.apiKey = st.settings.apimartApiKey || ''
            } else if (s.provider === 'dmfox') {
              next.apiKey = st.settings.dmfoxApiKey || ''
            }

            next.baseUrl = cfg.baseUrl
            next.model = cfg.model
          }
          return { settings: next }
        }),

      // Input
      prompt: '',
      setPrompt: (prompt) => set({ prompt }),
      inputImages: [],
      addInputImage: (img) =>
        set((s) => {
          if (s.inputImages.find((i) => i.id === img.id)) return s
          return { inputImages: [...s.inputImages, img] }
        }),
      removeInputImage: (idx) =>
        set((s) => ({
          inputImages: s.inputImages.filter((_, i) => i !== idx),
        })),
      clearInputImages: () =>
        set((s) => {
          for (const img of s.inputImages) imageCache.delete(img.id)
          return { inputImages: [] }
        }),
      setInputImages: (imgs) => set({ inputImages: imgs }),

      // Mask
      maskImage: null,
      setMaskImage: (maskImage) => set({ maskImage }),
      clearMaskImage: () => set((s) => {
        if (s.maskImage) imageCache.delete(s.maskImage.id)
        return { maskImage: null }
      }),

      // Params
      params: { ...DEFAULT_PARAMS },
      setParams: (p) => set((s) => ({ params: { ...s.params, ...p } })),

      // Tasks
      tasks: [],
      setTasks: (tasks) => set({ tasks }),

      // 文件夹
      folders: [],
      activeFolderId: null,
      setFolders: (folders) => set({ folders }),
      setActiveFolderId: (activeFolderId) => set({ activeFolderId }),

      // 多选
      selectedTaskIds: new Set(),
      toggleTaskSelection: (id) =>
        set((s) => {
          const next = new Set(s.selectedTaskIds)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          return { selectedTaskIds: next }
        }),
      selectAllTasks: (ids) => set({ selectedTaskIds: new Set(ids) }),
      clearSelection: () => set({ selectedTaskIds: new Set() }),

      // 搜索和筛选
      searchQuery: '',
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      filterStatus: 'all',
      setFilterStatus: (filterStatus) => set({ filterStatus }),

      // UI
      detailTaskId: null,
      setDetailTaskId: (detailTaskId) => set({ detailTaskId }),
      lightboxImageUrl: null,
      lightboxImageList: [],
      setLightboxImageUrl: (lightboxImageUrl, list) =>
        set({
          lightboxImageUrl,
          lightboxImageList: list ?? (lightboxImageUrl ? [lightboxImageUrl] : []),
        }),
      showSettings: false,
      setShowSettings: (showSettings) => set({ showSettings }),
      showFetchModal: false,
      setShowFetchModal: (showFetchModal) => set({ showFetchModal }),
      showStats: false,
      setShowStats: (showStats) => set({ showStats }),
      showDbManage: false,
      setShowDbManage: (showDbManage) => set({ showDbManage }),
      showMaskHelp: false,
      setShowMaskHelp: (showMaskHelp) => set({ showMaskHelp }),
      showMaskEditor: false,
      setShowMaskEditor: (showMaskEditor) => set({ showMaskEditor }),

      // Toast
      toast: null,
      showToast: (message, type = 'info', action) => {
        set({ toast: { message, type, action } })
        // 触觉反馈
        if (type === 'error') hapticNotification('error')
        else if (type === 'success') hapticImpact('light')
        setTimeout(() => {
          set((s) => (s.toast?.message === message ? { toast: null } : s))
        }, action ? 5000 : 3000)
      },

      // Confirm
      confirmDialog: null,
      setConfirmDialog: (confirmDialog) => set({ confirmDialog }),

      // Photo library
      photoLibrary: [],
      setPhotoLibrary: (photoLibrary) => set({ photoLibrary }),
      addPhotoLibraryImage: (img) =>
        set((s) => {
          if (s.photoLibrary.find((p) => p.id === img.id)) return s
          return { photoLibrary: [img, ...s.photoLibrary] }
        }),
      removePhotoLibraryImage: (id) =>
        set((s) => ({
          photoLibrary: s.photoLibrary.filter((p) => p.id !== id),
        })),
      showPhotoLibrary: false,
      setShowPhotoLibrary: (showPhotoLibrary) => set({ showPhotoLibrary }),
    }),
    {
      name: 'gpt-image-2-app',
      partialize: (state) => ({
        settings: state.settings,
        params: state.params,
        photoLibrary: state.photoLibrary,
        folders: state.folders,
      }),
      merge: (persisted: any, current) => {
        const merged = { ...current, ...persisted }
        // 兼容旧版没有的字段
        if (!merged.settings.provider) merged.settings.provider = 'apimart'
        if (!merged.settings.apimartApiKey) merged.settings.apimartApiKey = ''
        if (!merged.settings.dmfoxApiKey) merged.settings.dmfoxApiKey = ''
        return merged
      },
    },
  ),
)

// ===== Actions =====

let uid = 0
function genId(): string {
  return (
    Date.now().toString(36) +
    (++uid).toString(36) +
    Math.random().toString(36).slice(2, 6)
  )
}

/** 从 File 对象添加输入图片 */
export async function addImageFromFile(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const img: InputImage = {
    id: crypto.randomUUID ? crypto.randomUUID() : genId(),
    dataUrl,
  }
  imageCache.set(img.id, dataUrl)
  useStore.getState().addInputImage(img)
  return img.id
}

/**
 * 上传图片到服务端并保存到图片库
 * 返回上传后的远程 URL，如果上传失败则抛出异常
 */
export async function uploadToLibrary(file: File): Promise<string> {
  const { settings, showToast } = useStore.getState()

  if (!settings.apiKey) {
    showToast('请先配置 API Key', 'error')
    throw new Error('API Key 未配置')
  }

  // 先读取本地预览
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  // 上传到服务端
  const remoteUrl = await uploadImage(settings, file, file.name)
  const now = Date.now()

  const libImg: PhotoLibraryImage = {
    id: crypto.randomUUID ? crypto.randomUUID() : genId(),
    dataUrl,
    remoteUrl,
    uploadedAt: now,
    expiresAt: now + 72 * 60 * 60 * 1000, // 72 小时
    filename: file.name,
    fileSize: file.size,
  }

  useStore.getState().addPhotoLibraryImage(libImg)
  return remoteUrl
}

/**
 * 从图片库中选择图片作为参考图
 */
export function addLibraryImageToInput(libImg: PhotoLibraryImage) {
  const { inputImages, addInputImage, showToast } = useStore.getState()

  if (inputImages.length >= 16) {
    showToast('参考图数量已达上限（16 张）', 'error')
    return
  }

  if (inputImages.find((i) => i.id === libImg.id)) {
    showToast('该图片已在参考图中', 'info')
    return
  }

  addInputImage({
    id: libImg.id,
    dataUrl: libImg.dataUrl,
    remoteUrl: libImg.remoteUrl,
  })

  showToast('已添加到参考图', 'success')
}

/**
 * 清理图片库中过期的图片
 */
export function clearExpiredPhotos() {
  const { photoLibrary, setPhotoLibrary } = useStore.getState()
  const now = Date.now()
  const valid = photoLibrary.filter((p) => p.expiresAt > now)
  if (valid.length !== photoLibrary.length) {
    setPhotoLibrary(valid)
  }
}

/** 提交新任务（自动根据供应商选择同步/异步模式） */
export async function submitTask() {
  const { settings, prompt, inputImages, params, tasks, setTasks, showToast } =
    useStore.getState()
  hapticImpact('medium')

  if (!settings.apiKey) {
    showToast('请先在设置中配置 API Key', 'error')
    useStore.getState().setShowSettings(true)
    return
  }

  if (!prompt.trim() && !inputImages.length) {
    showToast('请输入提示词或添加参考图', 'error')
    return
  }

  const cfg = PROVIDER_CONFIG[settings.provider]

  // DM-Fox: 同步模式，直接调用并立即获取结果
  if (cfg && !cfg.isAsync) {
    const taskId = genId()
    const createdAt = Date.now()

    // 先创建一个运行中的任务
    const task: TaskRecord = {
      id: taskId,
      prompt: prompt.trim(),
      params: { ...params },
      inputImageIds: inputImages.map((i) => i.id),
      inputRemoteUrls: [],
      outputUrls: [],
      status: 'in_progress',
      error: null,
      progress: 0,
      createdAt,
      finishedAt: null,
      elapsed: null,
      provider: settings.provider,
    }
    setTasks([task, ...tasks])
    saveTasks([task, ...tasks].slice(0, 200)).catch(() => {})

    // DM-Fox 图生图：多张参考图合成一张拼图，通过 /v1/images/edits 提交
    // 遮罩图需提前检查，有遮罩时合成图必须用 PNG（alpha 通道兼容）
    const maskDataUrl = useStore.getState().maskImage?.dataUrl
    let inputDataUrls: string[] | undefined
    let compositeInputUrl: string | undefined
    if (inputImages.length > 0) {
      // 压缩大图后再提交
      const urls = await Promise.all(inputImages.map((i) => compressImage(i.dataUrl)))
      if (urls.length > 1) {
        try {
          const compositeFormat = maskDataUrl ? 'png' : params.output_format
          compositeInputUrl = await compositeImages(urls, compositeFormat)
          inputDataUrls = [compositeInputUrl]
        } catch {
          inputDataUrls = [urls[0]] // 合成失败 fallback
        }
      } else {
        inputDataUrls = urls
      }
    }

    try {
      // 网络错误重试 3 次（CapacitorHttp 原生层保持连接，切后台后恢复可继续）
      let result: Awaited<ReturnType<typeof submitGenerationSync>> | undefined
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          result = await submitGenerationSync(settings, task.prompt, task.params, inputDataUrls, maskDataUrl)
          break
        } catch (err) {
          if (attempt < 3 && isNetworkError(err)) {
            updateTaskInStore(taskId, { progress: Math.round(attempt * 30) })
            continue
          }
          throw err
        }
      }
      if (!result) throw new Error('生成失败')

      const finishedAt = Date.now()
      updateTaskInStore(taskId, {
        outputUrls: [...result.images],
        compositeInputUrl,
        revisedPrompt: result.revisedPrompt,
        usage: result.usage,
        status: 'completed',
        finishedAt,
        elapsed: finishedAt - createdAt,
      })
      showToast(`生成完成，共 ${result.images.length} 张图片`, 'success')
    } catch (err) {
      updateTaskInStore(taskId, {
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        finishedAt: Date.now(),
        elapsed: Date.now() - createdAt,
      })
      useStore.getState().setDetailTaskId(taskId)
    }
    return
  }

  // APIMart: 异步模式
  const taskId = genId()
  const task: TaskRecord = {
    id: taskId,
    prompt: prompt.trim(),
    params: { ...params },
    inputImageIds: inputImages.map((i) => i.id),
    inputRemoteUrls: [],
    outputUrls: [],
    status: 'submitted',
    error: null,
    progress: 0,
    createdAt: Date.now(),
    finishedAt: null,
    elapsed: null,
    provider: settings.provider,
  }

  const newTasks = [task, ...tasks]
  setTasks(newTasks)
  saveTasks(newTasks.slice(0, 200)).catch(() => {})

  executeTask(taskId).catch((err) => {
    showToast(`任务失败：${err.message}`, 'error')
  })
}

async function executeTask(taskId: string) {
  const { settings, inputImages, tasks, setTasks, showToast } = useStore.getState()
  const task = tasks.find((t) => t.id === taskId)
  if (!task) return

  try {
    updateTaskInStore(taskId, { status: 'in_progress' })

    // 1. 如果有输入图片，先上传到服务端获取 URL（优先从图片库和已有缓存获取）
    const remoteUrls: string[] = []
    const photoLibrary = useStore.getState().photoLibrary

    for (const imgId of task.inputImageIds) {
      const img = inputImages.find((i) => i.id === imgId)

      // 已有 remoteUrl 直接复用
      if (img?.remoteUrl) {
        remoteUrls.push(img.remoteUrl)
        continue
      }

      // 检查图片库中是否有已上传的 URL
      const libImg = photoLibrary.find(
        (p) => p.id === imgId || (img?.dataUrl && p.dataUrl === img.dataUrl),
      )
      if (libImg?.remoteUrl) {
        remoteUrls.push(libImg.remoteUrl)
        // 同时也更新 inputImages 的缓存
        if (img) {
          useStore.getState().setInputImages(
            inputImages.map((i) => (i.id === imgId ? { ...i, remoteUrl: libImg.remoteUrl } : i)),
          )
        }
        continue
      }

      // 新图片需要上传（先压缩大图）
      if (img?.dataUrl) {
        try {
          const compressed = await compressImage(img.dataUrl)
          const resp = await fetch(compressed)
          const blob = await resp.blob()
          const url = await uploadImage(settings, blob, `input-${imgId.slice(0, 8)}.png`)
          remoteUrls.push(url)
          useStore.getState().setInputImages(
            inputImages.map((i) => (i.id === imgId ? { ...i, remoteUrl: url } : i)),
          )
        } catch (err: any) {
          throw new Error(`图片上传失败：${err.message}`)
        }
      }
    }

    updateTaskInStore(taskId, { inputRemoteUrls: remoteUrls })

    // 1.5 如果有遮罩图，上传到服务端
    let maskUrl: string | undefined
    const maskImage = useStore.getState().maskImage
    if (maskImage) {
      if (maskImage.remoteUrl) {
        maskUrl = maskImage.remoteUrl
      } else if (maskImage.dataUrl) {
        try {
          const resp = await fetch(maskImage.dataUrl)
          const blob = await resp.blob()
          maskUrl = await uploadImage(settings, blob, `mask-${maskImage.id.slice(0, 8)}.png`)
          useStore.getState().setMaskImage({ ...maskImage, remoteUrl: maskUrl })
        } catch (err: any) {
          throw new Error(`遮罩图上传失败：${err.message}`)
        }
      }
    }

    // 2. 提交生成任务
    const remoteTaskId = await submitGeneration(settings, task.prompt, task.params, remoteUrls, maskUrl)
    updateTaskInStore(taskId, { remoteTaskId })

    // 3. 轮询任务状态（API 建议首次延迟 10~20 秒，之后每 3~5 秒一次）
    const firstDelay = 15000
    const pollInterval = 3000
    const maxAttempts = Math.max(1, Math.ceil(((settings.timeout * 1000) - firstDelay) / pollInterval))
    await new Promise((r) => setTimeout(r, Math.min(firstDelay, settings.timeout * 1000)))
    let attempts = 0
    let networkErrors = 0

    while (attempts < maxAttempts) {
      attempts++

      try {
        const data = await queryTask(settings, remoteTaskId)
        networkErrors = 0

        if (!data) {
          await new Promise((r) => setTimeout(r, pollInterval))
          continue
        }

        updateTaskInStore(taskId, { progress: data.progress ?? 0 })

        if (data.status === 'completed') {
          const imageUrls: string[] = []
          if (data.result?.images) {
            for (const img of data.result.images) {
              if (img.url && img.url.length > 0) {
                imageUrls.push(...img.url)
              }
            }
          }

          updateTaskInStore(taskId, {
            status: 'completed',
            outputUrls: imageUrls,
            finishedAt: Date.now(),
            elapsed: data.actual_time ? data.actual_time * 1000 : Date.now() - task.createdAt,
          })

          // 后台时发送系统通知
          if (document.hidden) {
            notifyTaskComplete('GPT Image', `生成完成，共 ${imageUrls.length} 张图片`, Date.now() % 100000)
          }
          showToast(`生成完成，共 ${imageUrls.length} 张图片`, 'success')
          return
        }

        if (data.status === 'failed') {
          throw new Error(data.fail_reason || data.error?.message || '生成失败')
        }
      } catch (err) {
        if (isNetworkError(err)) {
          networkErrors++
          if (networkErrors >= 5) throw new Error('网络连接失败，请检查网络')
          await new Promise((r) => setTimeout(r, pollInterval))
          continue
        }
        throw err
      }

      await new Promise((r) => setTimeout(r, pollInterval))
    }

    throw new Error(`任务超时（${settings.timeout}秒）`)
  } catch (err) {
    updateTaskInStore(taskId, {
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
      finishedAt: Date.now(),
      elapsed: Date.now() - task.createdAt,
    })
    useStore.getState().setDetailTaskId(taskId)
  }
}

/** 重试失败的任务 */
export async function retryTask(taskId: string) {
  const { tasks, settings, showToast } = useStore.getState()
  const task = tasks.find((t) => t.id === taskId)
  if (!task || task.status !== 'failed') return

  hapticImpact('medium')

  // 将任务状态重置为 in_progress，保留原始 createdAt（保持时间线一致）
  updateTaskInStore(taskId, {
    status: 'in_progress',
    error: null,
    progress: 0,
    finishedAt: null,
    elapsed: null,
  })

  const cfg = PROVIDER_CONFIG[settings.provider]

  if (cfg && !cfg.isAsync) {
    // DM-Fox 同步模式（网络错误重试 3 次）
    try {
      const { inputImages, maskImage } = useStore.getState()
      let inputDataUrls: string[] | undefined
      let compositeInputUrl: string | undefined
      if (task.inputImageIds?.length) {
        const matched = inputImages
          .filter((img) => task.inputImageIds!.includes(img.id))
          .map((img) => img.dataUrl)
        if (matched.length > 0) {
          // 压缩大图后再提交
          const urls = await Promise.all(matched.map((u) => compressImage(u)))
          if (urls.length > 1) {
            try {
              const compositeFormat = maskImage?.dataUrl ? 'png' : task.params.output_format
              compositeInputUrl = await compositeImages(urls, compositeFormat)
              inputDataUrls = [compositeInputUrl]
            } catch {
              inputDataUrls = [urls[0]]
            }
          } else {
            inputDataUrls = urls
          }
        }
      }
      // 使用当前 store 中的遮罩图
      const maskDataUrl = maskImage?.dataUrl

      let result: Awaited<ReturnType<typeof submitGenerationSync>> | undefined
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          result = await submitGenerationSync(settings, task.prompt, task.params, inputDataUrls, maskDataUrl)
          break
        } catch (err) {
          if (attempt < 3 && isNetworkError(err)) {
            updateTaskInStore(taskId, { progress: Math.round(attempt * 30) })
            continue
          }
          throw err
        }
      }
      if (!result) throw new Error('重试失败')
      updateTaskInStore(taskId, {
        status: 'completed',
        outputUrls: result.images,
        compositeInputUrl,
        revisedPrompt: result.revisedPrompt,
        usage: result.usage,
        progress: 100,
        finishedAt: Date.now(),
        elapsed: Date.now() - task.createdAt,
      })
      showToast('重试成功', 'success')
    } catch (err) {
      updateTaskInStore(taskId, {
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        finishedAt: Date.now(),
        elapsed: Date.now() - task.createdAt,
      })
    }
    return
  }

  // APIMart 异步模式：复用已上传的参考图 URL
  try {
    // 收集已上传的参考图 URL（优先使用任务记录的 inputRemoteUrls）
    const remoteUrls = [...(task.inputRemoteUrls || [])]
    // 还需要检查当前 store 中的 maskImage（如有也上传）
    let maskUrl: string | undefined
    const maskImage = useStore.getState().maskImage
    if (maskImage) {
      if (maskImage.remoteUrl) {
        maskUrl = maskImage.remoteUrl
      } else if (maskImage.dataUrl) {
        try {
          const resp = await fetch(maskImage.dataUrl)
          const blob = await resp.blob()
          maskUrl = await uploadImage(settings, blob, `mask-${maskImage.id.slice(0, 8)}.png`)
          useStore.getState().setMaskImage({ ...maskImage, remoteUrl: maskUrl })
        } catch {
          /* 遮罩上传失败不阻塞主流程 */
        }
      }
    }

    const remoteTaskId = await submitGeneration(settings, task.prompt, task.params, remoteUrls, maskUrl)
    updateTaskInStore(taskId, { remoteTaskId })

    // 轮询任务状态
    const firstDelay = 15000
    const pollInterval = 3000
    const maxAttempts = Math.max(1, Math.ceil(((settings.timeout * 1000) - firstDelay) / pollInterval))
    await new Promise((r) => setTimeout(r, Math.min(firstDelay, settings.timeout * 1000)))
    let attempts = 0
    let networkErrors = 0

    while (attempts < maxAttempts) {
      attempts++
      try {
        const data = await queryTask(settings, remoteTaskId)
        networkErrors = 0

        if (!data) {
          await new Promise((r) => setTimeout(r, pollInterval))
          continue
        }

        updateTaskInStore(taskId, { progress: data.progress ?? 0 })

        if (data.status === 'completed') {
          const imageUrls: string[] = []
          if (data.result?.images) {
            for (const img of data.result.images) {
              if (img.url && img.url.length > 0) imageUrls.push(...img.url)
            }
          }
          updateTaskInStore(taskId, {
            status: 'completed',
            outputUrls: imageUrls,
            finishedAt: Date.now(),
            elapsed: data.actual_time ? data.actual_time * 1000 : Date.now() - task.createdAt,
          })
          showToast('重试成功', 'success')
          return
        }

        if (data.status === 'failed') throw new Error(data.fail_reason || data.error?.message || '生成失败')
      } catch (err) {
        if (isNetworkError(err)) {
          networkErrors++
          if (networkErrors >= 5) throw new Error('网络连接失败，请检查网络')
          await new Promise((r) => setTimeout(r, pollInterval))
          continue
        }
        throw err
      }

      await new Promise((r) => setTimeout(r, pollInterval))
    }
    throw new Error(`任务超时（${settings.timeout}秒）`)
  } catch (err) {
    updateTaskInStore(taskId, {
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
      finishedAt: Date.now(),
      elapsed: Date.now() - task.createdAt,
    })
  }
}

function updateTaskInStore(taskId: string, patch: Partial<TaskRecord>) {
  const { tasks, setTasks } = useStore.getState()
  const updated = tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t))
  setTasks(updated)

  // 持久化到 IndexedDB（无配额限制）
  const newTask = updated.find((t) => t.id === taskId)
  if (newTask) {
    saveTasks(updated.slice(0, 200)).catch(() => {})
  }
}

/** 从 IndexedDB 恢复任务（首次运行时从 localStorage 迁移） */
export async function restoreTasks(): Promise<TaskRecord[]> {
  try {
    const tasks = await loadTasks<TaskRecord>()
    if (tasks.length > 0) return tasks
    // 首次启动：从 localStorage 迁移
    const migrated = await migrateFromLocalStorage<TaskRecord>()
    if (migrated.length > 0) return migrated
  } catch {
    /* ignore */
  }
  return []
}

/** 恢复中断的 in_progress 任务 */
export function resumeInProgressTasks() {
  const { tasks, showToast } = useStore.getState()
  const pendingTasks = tasks.filter(
    (t) => (t.status === 'in_progress' || t.status === 'submitted') && t.remoteTaskId,
  )
  const stuckSyncTasks = tasks.filter(
    (t) => t.status === 'in_progress' && !t.remoteTaskId,
  )

  // 同步任务（DM-Fox）无法恢复轮询，标记为失败并提示重试
  if (stuckSyncTasks.length > 0) {
    for (const t of stuckSyncTasks) {
      updateTaskInStore(t.id, {
        status: 'failed',
        error: 'APP 被中断，请重试',
        finishedAt: Date.now(),
      })
    }
    showToast(
      `${stuckSyncTasks.length} 个同步任务被中断`,
      'error',
      stuckSyncTasks.length === 1
        ? { label: '重试', onClick: () => retryTask(stuckSyncTasks[0].id) }
        : undefined,
    )
  }

  // 异步任务（APIMart）恢复轮询
  if (pendingTasks.length > 0) {
    showToast(`正在恢复 ${pendingTasks.length} 个任务...`, 'info')
    for (const t of pendingTasks) {
      executeTask(t.id).catch(() => {})
    }
  }
}

/** 初始化 store */
export async function initStore() {
  // 先加载缓存再设置任务，保证 TaskCard 渲染时缓存已就绪
  await Promise.all([initRemoteImageCache(), initThumbCache()])
  const tasks = await restoreTasks()
  useStore.getState().setTasks(tasks)
  // 强制刷新一次，确保任何缓存竞争条件被覆盖
  useStore.getState().setTasks([...useStore.getState().tasks])
  clearExpiredPhotos()

  // 恢复中断的任务
  resumeInProgressTasks()
}

/** 复用任务配置 */
export function reuseConfig(task: TaskRecord) {
  const { setPrompt, setParams, showToast } = useStore.getState()
  setPrompt(task.prompt)
  setParams(task.params)
  showToast('已复用配置到输入框', 'success')
}

/** 删除任务 */
export function removeTask(taskId: string) {
  const { tasks, setTasks, folders, setFolders, showToast } = useStore.getState()
  const deleted = tasks.find((t) => t.id === taskId)
  const remaining = tasks.filter((t) => t.id !== taskId)
  setTasks(remaining)
  saveTasks(remaining.slice(0, 200)).catch(() => {})
  // 保存被删除任务原本所在的文件夹
  const affectedFolders = folders.filter((f) => f.taskIds.includes(taskId))
  // 从所有文件夹中移除该任务引用
  if (affectedFolders.length > 0) {
    setFolders(folders.map((f) => ({ ...f, taskIds: f.taskIds.filter((id) => id !== taskId) })))
  }
  showToast('记录已删除', 'success', {
    label: '撤销',
    onClick: () => {
      if (!deleted) return
      const { tasks: cur, setTasks: setT, folders: curF, setFolders: setF } = useStore.getState()
      setT([...cur, deleted])
      saveTasks([...cur, deleted].slice(0, 200)).catch(() => {})
      if (affectedFolders.length > 0) {
        setF(curF.map((f) => {
          const orig = affectedFolders.find((af) => af.id === f.id)
          return orig ? { ...f, taskIds: [...f.taskIds, taskId] } : f
        }))
      }
    },
  })
}

/** 批量删除任务 */
export function removeTasks(taskIds: string[]) {
  if (!taskIds.length) return
  const idSet = new Set(taskIds)
  const { tasks, setTasks, folders, setFolders, clearSelection, showToast } = useStore.getState()
  const deleted = tasks.filter((t) => idSet.has(t.id))
  const remaining = tasks.filter((t) => !idSet.has(t.id))
  setTasks(remaining)
  saveTasks(remaining.slice(0, 200)).catch(() => {})
  // 保存被删除任务原本所在的文件夹
  const affectedFolders = folders.filter((f) => f.taskIds.some((id) => idSet.has(id))).map((f) => ({
    id: f.id,
    taskIds: f.taskIds.filter((id) => idSet.has(id)),
  }))
  if (affectedFolders.length > 0) {
    setFolders(folders.map((f) => ({ ...f, taskIds: f.taskIds.filter((id) => !idSet.has(id)) })))
  }
  clearSelection()
  showToast(`已删除 ${idSet.size} 条记录`, 'success', {
    label: '撤销',
    onClick: () => {
      const { tasks: cur, setTasks: setT, folders: curF, setFolders: setF } = useStore.getState()
      setT([...cur, ...deleted])
      saveTasks([...cur, ...deleted].slice(0, 200)).catch(() => {})
      if (affectedFolders.length > 0) {
        setF(curF.map((f) => {
          const orig = affectedFolders.find((af) => af.id === f.id)
          return orig ? { ...f, taskIds: [...new Set([...f.taskIds, ...orig.taskIds])] } : f
        }))
      }
    },
  })
}

/** 批量移动任务到文件夹 */
export function moveTasksToFolder(taskIds: string[], folderId: string) {
  if (!taskIds.length) return
  const idSet = new Set(taskIds)
  const { folders, setFolders, clearSelection, showToast } = useStore.getState()
  setFolders(
    folders.map((f) => {
      if (f.id === folderId) {
        // 添加（去重）
        const merged = [...new Set([...f.taskIds, ...idSet])]
        return { ...f, taskIds: merged }
      }
      // 从其他文件夹移除
      return { ...f, taskIds: f.taskIds.filter((id) => !idSet.has(id)) }
    }),
  )
  clearSelection()
  showToast(`已移动 ${idSet.size} 个任务到文件夹`, 'success')
}

/** 清空所有数据 */
export async function clearAllData() {
  // 清空 IndexedDB（任务、远程图片缓存、缩略图缓存全部删除）
  await clearAllIndexedDB().catch(() => {})
  // 清空 localStorage（Zustand 持久化：设置、图片库、文件夹）
  try { localStorage.removeItem('gpt-image-2-app') } catch { /* ignore */ }
  try { localStorage.removeItem('gpt-image-2-dark-mode') } catch { /* ignore */ }
  // 清空内存缓存
  imageCache.clear()
  remoteImageCache.clear()
  thumbCache.clear()
  const { setTasks, clearInputImages, setSettings, setParams, setPhotoLibrary, setFolders, clearSelection, setSearchQuery, setMaskImage, showToast } = useStore.getState()
  setTasks([])
  clearInputImages()
  setMaskImage(null)
  setSettings({ ...DEFAULT_SETTINGS })
  setParams({ ...DEFAULT_PARAMS })
  setPhotoLibrary([])
  setFolders([])
  clearSelection()
  setSearchQuery('')
  showToast('所有数据已清空', 'success')
}

/**
 * 图片放大（Upscale）：将已完成任务的输出图作为参考图，以更高分辨率重新生成
 * @param imageUrl 要放大的图片 URL
 * @param prompt 原始 prompt
 * @param currentParams 当前参数（用于推断更高分辨率）
 */
export async function upscaleImage(
  imageUrl: string,
  prompt: string,
  currentParams: TaskParams,
) {
  const { showToast, setPrompt, addInputImage, setParams, setShowPhotoLibrary } =
    useStore.getState()

  // 确定目标分辨率：1k→2k→4k
  const resolutionOrder: Array<'1k' | '2k' | '4k'> = ['1k', '2k', '4k']
  const currentIdx = resolutionOrder.indexOf(currentParams.resolution)
  const targetRes = currentIdx < 2 ? resolutionOrder[currentIdx + 1] : '4k'

  // 下载图片到本地
  let dataUrl: string
  try {
    const resp = await fetch(imageUrl)
    const blob = await resp.blob()
    dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    showToast('图片下载失败，无法放大', 'error')
    return
  }

  const imgId = crypto.randomUUID ? crypto.randomUUID() : genId()
  imageCache.set(imgId, dataUrl)

  addInputImage({ id: imgId, dataUrl })
  setPrompt(`高清放大: ${prompt}`)
  setParams({
    size: currentParams.size,
    resolution: targetRes,
    quality: 'high',
    n: 1,
  })

  showToast(`已设置放大为 ${targetRes.toUpperCase()}，检查参数后点击生成`, 'success')
}

/** 从服务端拉取远程任务（通过 task_id 查询）并存入本地 */
export async function fetchRemoteTask(remoteTaskId: string) {
  const { settings, tasks, setTasks, showToast } = useStore.getState()

  if (!settings.apiKey) {
    showToast('请先在设置中配置 API Key', 'error')
    useStore.getState().setShowSettings(true)
    return
  }

  if (!remoteTaskId.trim()) {
    showToast('请输入有效的 task_id', 'error')
    return
  }

  try {
    const data = await queryTask(settings, remoteTaskId.trim())
    if (!data) {
      showToast('未找到该任务或查询失败', 'error')
      return
    }

    // 检查是否已存在
    const existing = tasks.find((t) => t.remoteTaskId === remoteTaskId.trim())
    if (existing) {
      // 更新已有任务
      const updated = tasks.map((t) =>
        t.remoteTaskId === remoteTaskId.trim()
          ? {
              ...t,
              status: mapRemoteStatus(data.status),
              progress: data.progress ?? 0,
              outputUrls: extractImageUrls(data),
              error: data.fail_reason || data.error?.message || null,
              finishedAt: data.status === 'completed' || data.status === 'failed' ? Date.now() : null,
              elapsed: data.actual_time ? data.actual_time * 1000 : null,
            }
          : t,
      )
      setTasks(updated)
      saveTasksToLocal(updated)
      showToast('任务状态已更新', 'success')
      return
    }

    // 创建新任务记录
    const newTask: TaskRecord = {
      id: 'remote-' + remoteTaskId.trim().slice(-16),
      remoteTaskId: remoteTaskId.trim(),
      prompt: '(远程拉取的任务)',
      params: { ...DEFAULT_PARAMS },
      inputImageIds: [],
      inputRemoteUrls: [],
      outputUrls: extractImageUrls(data),
      status: mapRemoteStatus(data.status),
      error: data.fail_reason || data.error?.message || null,
      progress: data.progress ?? 0,
      createdAt: Date.now(),
      finishedAt: data.status === 'completed' || data.status === 'failed' ? Date.now() : null,
      elapsed: data.actual_time ? data.actual_time * 1000 : null,
    }

    const newTasks = [newTask, ...tasks]
    setTasks(newTasks)
    saveTasksToLocal(newTasks)

    showToast('任务已拉取', 'success')
  } catch (err) {
    showToast(`拉取失败：${err instanceof Error ? err.message : String(err)}`, 'error')
  }
}

function mapRemoteStatus(remoteStatus: string): TaskRecord['status'] {
  switch (remoteStatus) {
    case 'completed':
      return 'completed'
    case 'failed':
      return 'failed'
    case 'submitted':
      return 'submitted'
    case 'in_progress':
      return 'in_progress'
    default:
      return 'in_progress'
  }
}

function extractImageUrls(data: NonNullable<import('./types').TaskQueryResponse['data']>): string[] {
  if (data.result?.images) {
    return data.result.images.flatMap((img) => img.url || [])
  }
  return []
}

function saveTasksToLocal(tasks: TaskRecord[]) {
  saveTasks(tasks.slice(0, 200)).catch(() => {})
}
