import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppSettings, TaskParams, InputImage, TaskRecord, PhotoLibraryImage } from './types'
import { DEFAULT_SETTINGS, DEFAULT_PARAMS, PROVIDER_CONFIG } from './types'
import { submitGeneration, submitGenerationSync, queryTask, uploadImage } from './lib/api'


// ===== 简单的内存 image cache =====
const imageCache = new Map<string, string>()

export function getCachedImage(id: string): string | undefined {
  return imageCache.get(id)
}

export function setCachedImage(id: string, dataUrl: string) {
  imageCache.set(id, dataUrl)
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

  // Toast
  toast: { message: string; type: 'info' | 'success' | 'error' } | null
  showToast: (message: string, type?: 'info' | 'success' | 'error') => void

  // Confirm dialog
  confirmDialog: {
    title: string
    message: string
    action: () => void
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
          // 切换供应商时自动更新 baseUrl 和 model
          if (s.provider && s.provider !== st.settings.provider) {
            const cfg = PROVIDER_CONFIG[s.provider]
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

      // Search & Filter
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

      // Toast
      toast: null,
      showToast: (message, type = 'info') => {
        set({ toast: { message, type } })
        setTimeout(() => {
          set((s) => (s.toast?.message === message ? { toast: null } : s))
        }, 3000)
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
      }),
      merge: (persisted: any, current) => {
        const merged = { ...current, ...persisted }
        // 兼容旧版没有的字段
        if (!merged.settings.provider) merged.settings.provider = 'apimart'
        if (!merged.settings.apimartApiKey) merged.settings.apimartApiKey = ''
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
    }
    setTasks([task, ...tasks])

    // DM-Fox 图生图：先上传参考图到 APIMart 获取 URL，再作为 image 参数发送
    let inputUrls: string[] | undefined
    if (inputImages.length > 0) {
      try {
        const urls: string[] = []
        for (const img of inputImages) {
          if (img.remoteUrl) {
            urls.push(img.remoteUrl)
          } else {
            const resp = await fetch(img.dataUrl)
            const blob = await resp.blob()
            const url = await uploadImage(settings, blob, `ref-${img.id.slice(0, 8)}.png`)
            urls.push(url)
          }
        }
        inputUrls = urls
      } catch (err: any) {
        useStore.getState().showToast(`参考图上传失败：${err.message}`, 'error')
        updateTaskInStore(taskId, {
          status: 'failed',
          error: `参考图上传失败：${err.message}`,
          finishedAt: Date.now(),
          elapsed: Date.now() - createdAt,
        })
        return
      }
    }

    try {
      const result = await submitGenerationSync(settings, task.prompt, task.params, inputUrls)
      const finishedAt = Date.now()
      // 保存为 data URL 到缓存
      const outputIds: string[] = []
      for (const dataUrl of result.images) {
        const id = crypto.randomUUID ? crypto.randomUUID() : genId()
        imageCache.set(id, dataUrl)
        outputIds.push(id)
      }
      updateTaskInStore(taskId, {
        outputUrls: outputIds.map((id) => imageCache.get(id)!),
        revisedPrompt: result.revisedPrompt,
        usage: result.usage,
        status: 'completed',
        finishedAt,
        elapsed: finishedAt - createdAt,
      })
      showToast(`生成完成，共 ${outputIds.length} 张图片`, 'success')
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
  }

  const newTasks = [task, ...tasks]
  setTasks(newTasks)

  executeTask(taskId).catch((err) => {
    showToast(`任务失败：${err.message}`, 'error')
  })
}

async function executeTask(taskId: string) {
  const { settings, inputImages, tasks, showToast } = useStore.getState()
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

      // 新图片需要上传
      if (img?.dataUrl) {
        try {
          const resp = await fetch(img.dataUrl)
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

    while (attempts < maxAttempts) {
      attempts++

      const data = await queryTask(settings, remoteTaskId)
      if (!data) continue

      updateTaskInStore(taskId, { progress: data.progress ?? 0 })

      if (data.status === 'completed') {
        // 任务完成，获取图片 URL
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

        showToast(`生成完成，共 ${imageUrls.length} 张图片`, 'success')
        return
      }

      if (data.status === 'failed') {
        throw new Error(data.fail_reason || data.error?.message || '生成失败')
      }
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

function updateTaskInStore(taskId: string, patch: Partial<TaskRecord>) {
  const { tasks, setTasks } = useStore.getState()
  const updated = tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t))
  setTasks(updated)

  // 持久化到 localStorage
  try {
    const key = 'gpt-image-2-app-tasks'
    const stored = JSON.parse(localStorage.getItem(key) || '[]')
    const idx = stored.findIndex((t: any) => t.id === taskId)
    const newTask = updated.find((t) => t.id === taskId)
    if (idx >= 0) {
      stored[idx] = newTask
    } else if (newTask) {
      stored.unshift(newTask)
    }
    localStorage.setItem(key, JSON.stringify(stored.slice(0, 200)))
  } catch {
    /* ignore */
  }
}

/** 从 localStorage 恢复任务 */
export function restoreTasks(): TaskRecord[] {
  try {
    const key = 'gpt-image-2-app-tasks'
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

/** 初始化 store */
export function initStore() {
  const tasks = restoreTasks()
  useStore.getState().setTasks(tasks)
  // 清理已过期的图片
  clearExpiredPhotos()
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
  const { tasks, setTasks, showToast } = useStore.getState()
  const remaining = tasks.filter((t) => t.id !== taskId)
  setTasks(remaining)

  try {
    const key = 'gpt-image-2-app-tasks'
    const stored = JSON.parse(localStorage.getItem(key) || '[]')
    localStorage.setItem(key, JSON.stringify(stored.filter((t: any) => t.id !== taskId)))
  } catch {
    /* ignore */
  }

  showToast('记录已删除', 'success')
}

/** 清空所有数据 */
export async function clearAllData() {
  try {
    const key = 'gpt-image-2-app-tasks'
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
  imageCache.clear()
  const { clearInputImages, setSettings, setParams, setTasks, showToast } = useStore.getState()
  clearInputImages()
  setSettings({ ...DEFAULT_SETTINGS })
  setParams({ ...DEFAULT_PARAMS })
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
  const { showToast, setPrompt, addInputImage, setParams } =
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
  try {
    const key = 'gpt-image-2-app-tasks'
    localStorage.setItem(key, JSON.stringify(tasks.slice(0, 200)))
  } catch {
    /* ignore */
  }
}
