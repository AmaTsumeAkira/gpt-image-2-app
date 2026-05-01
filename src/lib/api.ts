import type { AppSettings, ImageGenerationResponse, TaskQueryResponse, TaskParams, UploadImageResponse } from '../types'
import { ratioToPixels } from './size'

export function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

/**
 * 上传图片到 APIMart 服务器，返回可公开访问的 URL
 * 不论当前使用哪个供应商，都统一传到 APIMart（DM-Fox 无上传接口）
 * 使用 settings.apimartApiKey（与当前供应商的 apiKey 可能不同）
 */
export async function uploadImage(
  settings: AppSettings,
  file: Blob | File,
  filename: string,
): Promise<string> {
  const formData = new FormData()
  formData.append('file', file, filename)

  // 强制使用 APIMart 的上传接口
  const uploadBaseUrl = 'https://api.apimart.ai'
  const uploadKey = settings.apimartApiKey || settings.apiKey

  console.log('[uploadImage]', { url: `${uploadBaseUrl}/v1/uploads/images`, fileSize: file.size, fileType: file.type, filename })

  const response = await fetch(`${uploadBaseUrl}/v1/uploads/images`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${uploadKey}`,
    },
    body: formData,
  })

  if (!response.ok) {
    let errorMsg = `上传失败：HTTP ${response.status}`
    try {
      const errJson = await response.json()
      if (errJson.error?.message) errorMsg = errJson.error.message
    } catch {
      /* ignore */
    }
    throw new Error(errorMsg)
  }

  const payload = (await response.json()) as UploadImageResponse
  if (!payload.url) {
    throw new Error(payload.error?.message || '上传返回异常')
  }
  return payload.url
}

/**
 * 提交图像生成任务（异步模式）
 * 返回 task_id
 */
export async function submitGeneration(
  settings: AppSettings,
  prompt: string,
  params: TaskParams,
  imageUrls: string[],
  maskUrl?: string,
): Promise<string> {
  const body: Record<string, unknown> = {
    model: settings.model,
    prompt: prompt.trim(),
    size: params.size,
    quality: params.quality,
    output_format: params.output_format,
    moderation: params.moderation,
    background: params.background,
  }

  // resolution 字段
  if (params.resolution) {
    body.resolution = params.resolution
  }

  // output_compression
  if (params.output_format !== 'png' && params.output_compression != null) {
    body.output_compression = params.output_compression
  }

  // n
  if (params.n > 1) {
    body.n = params.n
  }

  // 参考图
  if (imageUrls.length > 0) {
    body.image_urls = imageUrls
  }

  // 遮罩图
  if (maskUrl) {
    body.mask_url = maskUrl
  }

  const response = await fetch(`${normalizeBaseUrl(settings.baseUrl)}/v1/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}`
    try {
      const errJson = await response.json()
      if (errJson.error?.message) errorMsg = errJson.error.message
    } catch {
      try {
        errorMsg = await response.text()
      } catch {
        /* ignore */
      }
    }
    throw new Error(errorMsg)
  }

  const payload = (await response.json()) as ImageGenerationResponse

  if (payload.error) {
    throw new Error(payload.error.message)
  }

  const taskId = payload.data?.[0]?.task_id
  if (!taskId) {
    throw new Error('接口未返回 task_id')
  }

  return taskId
}

/**
 * 查询任务状态
 */
export async function queryTask(
  settings: AppSettings,
  taskId: string,
): Promise<TaskQueryResponse['data']> {
  const response = await fetch(
    `${normalizeBaseUrl(settings.baseUrl)}/v1/tasks/${taskId}?language=zh`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        'Cache-Control': 'no-store',
      },
    },
  )

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}`
    try {
      const errJson = await response.json()
      if (errJson.error?.message) errorMsg = errJson.error.message
    } catch {
      /* ignore */
    }
    throw new Error(errorMsg)
  }

  const payload = (await response.json()) as TaskQueryResponse

  if (payload.error) {
    throw new Error(payload.error.message)
  }

  return payload.data
}

/**
 * 批量查询任务状态（多个 task_id 并发查询）
 */
export async function batchQueryTasks(
  settings: AppSettings,
  taskIds: string[],
): Promise<Map<string, NonNullable<TaskQueryResponse['data']>>> {
  const results = new Map<string, NonNullable<TaskQueryResponse['data']>>()

  // 并发查询，每批最多 5 个
  const batchSize = 5
  for (let i = 0; i < taskIds.length; i += batchSize) {
    const batch = taskIds.slice(i, i + batchSize)
    const promises = batch.map(async (taskId) => {
      try {
        const data = await queryTask(settings, taskId)
        if (data) results.set(taskId, data)
      } catch {
        // 单个失败不影响其他
      }
    })
    await Promise.all(promises)
  }

  return results
}

/**
 * data URL 转 Blob（纯前端解析，无需网络请求）
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',', 2)
  if (!header || !base64) throw new Error('无效的 data URL 格式')
  const mime = header.match(/:(.*?);/)?.[1] || 'image/png'
  const binary = atob(base64)
  const array = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i)
  }
  return new Blob([array], { type: mime })
}

/** 最大上传尺寸（长边），超过则压缩 */
const MAX_UPLOAD_DIM = 2048

/**
 * 压缩图片：超过 maxDim 时等比缩小，导出为 JPEG 以减小体积
 * 返回 data URL（可能与输入相同，如果不需要压缩）
 */
export async function compressImage(
  dataUrl: string,
  maxDim: number = MAX_UPLOAD_DIM,
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img
      // 不需要压缩
      if (w <= maxDim && h <= maxDim) {
        resolve(dataUrl)
        return
      }
      const scale = maxDim / Math.max(w, h)
      const cw = Math.round(w * scale)
      const ch = Math.round(h * scale)
      const canvas = document.createElement('canvas')
      canvas.width = cw
      canvas.height = ch
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, cw, ch)
      resolve(canvas.toDataURL('image/jpeg', 0.9))
    }
    img.onerror = () => resolve(dataUrl) // 解析失败则原样返回
    img.src = dataUrl
  })
}

/**
 * 解析同步 API 响应（适用于 generations / edits 返回的 OpenAI 兼容格式）
 */
async function parseSyncResponse(
  response: Response,
  mime: string,
): Promise<import('../types').SyncGenerationResult> {
  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}`
    let errorBody = ''
    try {
      errorBody = await response.text()
      console.error('[parseSyncResponse] HTTP error', { status: response.status, statusText: response.statusText, body: errorBody.slice(0, 500) })
      // 尝试解析 JSON 错误消息
      try {
        const errJson = JSON.parse(errorBody)
        if (errJson.error?.message) errorMsg = errJson.error.message
      } catch { /* 非 JSON 响应 */ }
    } catch {
      /* 无法读取响应体 */
    }
    throw new Error(errorMsg)
  }

  const payload = (await response.json()) as import('../types').SyncImageApiResponse

  if (payload.error) {
    throw new Error(payload.error.message)
  }

  const data = payload.data
  if (!Array.isArray(data) || !data.length) {
    throw new Error('接口未返回图片数据')
  }

  const images: string[] = []
  let revisedPrompt: string | undefined

  for (const item of data) {
    if (!revisedPrompt && item.revised_prompt) {
      revisedPrompt = item.revised_prompt
    }

    if (item.b64_json) {
      const prefix = item.b64_json.startsWith('data:') ? '' : `data:${mime};base64,`
      images.push(`${prefix}${item.b64_json}`)
      continue
    }
    if (item.url && /^https?:\/\//i.test(item.url)) {
      const resp = await fetch(item.url, { cache: 'no-store' })
      const blob = await resp.blob()
      const dataUrl = await new Promise<string>((res, rej) => {
        const reader = new FileReader()
        reader.onload = () => res(reader.result as string)
        reader.onerror = rej
        reader.readAsDataURL(blob)
      })
      images.push(dataUrl)
    }
  }

  if (!images.length) {
    throw new Error('接口未返回可用图片数据')
  }

  return { images, revisedPrompt, usage: payload.usage }
}

/**
 * 带超时和自动重试的 fetch（网络错误最多重试 3 次，指数退避）
 * 有 AbortController → 服务端能感知客户端断开，避免代理层 502
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const maxAttempts = 3
  let lastErr: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      })
      return response
    } catch (err) {
      lastErr = err
      // 只有网络错误才重试，HTTP 错误不重试
      if (err instanceof TypeError || (err instanceof DOMException && err.name === 'AbortError')) {
        if (attempt < maxAttempts) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000) // 2s → 4s → 8s
          await new Promise((r) => setTimeout(r, delay))
          continue
        }
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  throw lastErr
}

/**
 * 带重试但无超时的 fetch（用于长时间请求）
 * 不使用 AbortController，依赖 CapacitorHttp 原生层保持连接
 * APP 切后台时原生 HTTP 层继续工作，WebView 恢复后 promise 自然 resolve
 * 注意：仅用于非 DM-Fox 场景；DM-Fox 需要 AbortController 避免代理 502
 */
async function fetchWithRetryNoTimeout(url: string, init: RequestInit): Promise<Response> {
  const maxAttempts = 3
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fetch(url, init)
    } catch (err) {
      const isNetwork = err instanceof TypeError || (err instanceof DOMException && err.name === 'AbortError')
      if (attempt < maxAttempts && isNetwork) {
        await new Promise((r) => setTimeout(r, 2000 * attempt))
        continue
      }
      throw err
    }
  }
  throw new Error('请求失败')
}

/**
 * 同步图像生成（适用于 DM-Fox 等 OpenAI 兼容供应商，直接返回图片）
 *
 * - 文生图：POST /v1/images/generations（JSON body）
 * - 图生图：POST /v1/images/edits（multipart/form-data，首张参考图 + 可选遮罩）
 */
export async function submitGenerationSync(
  settings: AppSettings,
  prompt: string,
  params: TaskParams,
  /** 输入图片的 base64 data URL 列表（首张用于 edits，多余忽略） */
  inputImageDataUrls?: string[],
  /** 遮罩图 data URL（仅 edits 模式有效） */
  maskDataUrl?: string,
): Promise<import('../types').SyncGenerationResult> {
  const mimeMap: Record<string, string> = {
    png: 'image/png',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
  }
  const mime = mimeMap[params.output_format] || 'image/png'

  // DM-Fox API 要求 size 必须为 WxH 像素格式（如 "1536x1024"），不支持比例
  const resolvedSize = ratioToPixels(params.size, params.resolution) || params.size

  const hasInput = inputImageDataUrls && inputImageDataUrls.length > 0
  const isDmfox = settings.baseUrl.includes('dm-fox.rjj.cc')
  // DM-Fox 同步请求超时设为 600s（比用户设置的 timeout 更宽松，避免代理层 502）
  const timeoutMs = isDmfox ? 600_000 : (settings.timeout || 300) * 1000

  // Capacitor 环境下没有 Vite proxy，需要直连
  const isCapacitor = !!(window as any).Capacitor?.isNativePlatform?.()
  // DM-Fox 无 CORS 头，开发环境走 Vite proxy；Capacitor/其他供应商直连
  const syncUrl = (endpoint: string) =>
    isDmfox && !isCapacitor
      ? `/codex/v1/${endpoint}`
      : `${normalizeBaseUrl(settings.baseUrl)}/v1/${endpoint}`

  if (hasInput) {
    // 路径 A — 图生图：POST /v1/images/edits（multipart/form-data）
    const apiUrl = syncUrl('images/edits')
    const formData = new FormData()
    const imageBlob = dataUrlToBlob(inputImageDataUrls[0])
    console.log('[submitGenerationSync:edits]', { apiUrl, imageSize: imageBlob.size, imageType: imageBlob.type, hasMask: !!maskDataUrl, timeoutMs })
    formData.append('image', imageBlob, 'input.png')
    formData.append('prompt', prompt.trim())
    formData.append('model', settings.model)
    formData.append('n', String(params.n || 1))
    formData.append('size', resolvedSize)
    if (params.quality && params.quality !== 'auto') {
      formData.append('quality', params.quality)
    }
    if (maskDataUrl) {
      formData.append('mask', dataUrlToBlob(maskDataUrl), 'mask.png')
    }

    return parseSyncResponse(
      await fetchWithRetry(apiUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${settings.apiKey}` },
        body: formData,
      }, timeoutMs),
      mime,
    )
  }

  // 路径 B — 文生图：POST /v1/images/generations（JSON body）
  const apiUrl = syncUrl('images/generations')
  console.log('[submitGenerationSync:generations]', { apiUrl, model: settings.model, size: resolvedSize, n: params.n, timeoutMs })

  return parseSyncResponse(
    await fetchWithRetry(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.model,
        prompt: prompt.trim(),
        size: resolvedSize,
        quality: params.quality,
        n: params.n || 1,
      }),
    }, timeoutMs),
    mime,
  )
}

/**
 * 查询用户余额
 */
export async function queryBalance(settings: AppSettings): Promise<import('../types').BalanceResponse> {
  const response = await fetch(`${normalizeBaseUrl(settings.baseUrl)}/v1/user/balance`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      'Cache-Control': 'no-store',
    },
  })

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}`
    try {
      const errJson = await response.json()
      if (errJson.error?.message) errorMsg = errJson.error.message
    } catch {
      /* ignore */
    }
    throw new Error(errorMsg)
  }

  return (await response.json()) as import('../types').BalanceResponse
}

/**
 * 将远程图片 URL 转为 data URL（用于本地预览）
 */
export async function fetchImageAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`图片下载失败：HTTP ${response.status}`)
  }
  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
