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
 * 同步图像生成（适用于 DM-Fox 等 OpenAI 兼容供应商，直接返回图片）
 */
export async function submitGenerationSync(
  settings: AppSettings,
  prompt: string,
  params: TaskParams,
  /** 输入图片的 base64 data URL 列表（用于图生图/图片编辑） */
  inputImageDataUrls?: string[],
): Promise<import('../types').SyncGenerationResult> {
  const mimeMap: Record<string, string> = {
    png: 'image/png',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
  }
  const mime = mimeMap[params.output_format] || 'image/png'

  // DM-Fox API 要求 size 必须为 WxH 像素格式（如 "1536x1024"），不支持比例
  const resolvedSize = ratioToPixels(params.size, params.resolution) || params.size

  const body: Record<string, unknown> = {
    model: settings.model,
    prompt: prompt.trim(),
    size: resolvedSize,
    quality: params.quality,
    n: params.n || 1,
  }

  // 如果有参考图 URL，作为 image 参数发送（图生图/图片编辑）
  // 调用方负责先上传图片到 APIMart 获取 URL，再传入此处
  if (inputImageDataUrls && inputImageDataUrls.length > 0) {
    body.image = inputImageDataUrls.length === 1
      ? inputImageDataUrls[0]
      : inputImageDataUrls
  }

  // DM-Fox：使用 Vite 代理路径绕过 CORS（开发环境）
  // 生产环境需服务端配置 CORS 或使用同方式代理
  const isDmfox = settings.baseUrl.includes('dm-fox.rjj.cc')
  const apiUrl = isDmfox
    ? `/codex/v1/images/generations`  // 走 Vite proxy
    : `${normalizeBaseUrl(settings.baseUrl)}/v1/images/generations`

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}`
    try {
      const errJson = await response.json()
      if (errJson.error?.message) errorMsg = errJson.error.message
    } catch {
      try { errorMsg = await response.text() } catch { /* ignore */ }
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
    // 提取 revised_prompt（取第一个非空的）
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
