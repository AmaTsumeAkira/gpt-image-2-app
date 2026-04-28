// ===== 供应商 =====
export type Provider = 'apimart' | 'dmfox'

export const PROVIDER_CONFIG: Record<Provider, { label: string; baseUrl: string; model: string; isAsync: boolean }> = {
  apimart: {
    label: 'APIMart',
    baseUrl: 'https://api.apimart.ai',
    model: 'gpt-image-2-official',
    isAsync: true,
  },
  dmfox: {
    label: 'DM-Fox',
    baseUrl: 'https://dm-fox.rjj.cc/codex',
    model: 'gpt-image-2',
    isAsync: false,
  },
}

// ===== 设置 =====
export interface AppSettings {
  provider: Provider
  baseUrl: string
  apiKey: string
  /** APIMart 专用 API Key（用于图片上传等，与 DM-Fox 的 key 可能不同） */
  apimartApiKey: string
  model: string
  timeout: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  provider: 'apimart',
  baseUrl: 'https://api.apimart.ai',
  apiKey: '',
  apimartApiKey: '',
  model: 'gpt-image-2-official',
  timeout: 300,
}

// ===== 任务参数 =====
export interface TaskParams {
  size: string
  resolution: '1k' | '2k' | '4k'
  quality: 'auto' | 'low' | 'medium' | 'high'
  background: 'auto' | 'opaque' | 'transparent'
  output_format: 'png' | 'jpeg' | 'webp'
  output_compression: number | null
  moderation: 'auto' | 'low'
  n: number
}

export const DEFAULT_PARAMS: TaskParams = {
  size: 'auto',
  resolution: '1k',
  quality: 'auto',
  background: 'auto',
  output_format: 'png',
  output_compression: null,
  moderation: 'auto',
  n: 1,
}

// ===== 输入图片 =====
export interface InputImage {
  id: string
  dataUrl: string
  /** 上传后服务端返回的 URL */
  remoteUrl?: string
}

// ===== 图片库 =====
export interface PhotoLibraryImage {
  id: string
  /** 本地预览 dataUrl */
  dataUrl: string
  /** 服务端公开访问 URL（72 小时有效） */
  remoteUrl: string
  /** 上传时间戳 */
  uploadedAt: number
  /** 过期时间戳 */
  expiresAt: number
  /** 文件名 */
  filename: string
  /** 文件大小(bytes) */
  fileSize: number
}

// ===== 任务记录 =====
export type TaskStatus = 'submitted' | 'in_progress' | 'completed' | 'failed'

export interface TaskRecord {
  id: string
  remoteTaskId?: string
  prompt: string
  params: TaskParams
  inputImageIds: string[]
  inputRemoteUrls: string[]
  outputUrls: string[]
  status: TaskStatus
  error: string | null
  progress: number
  createdAt: number
  finishedAt: number | null
  elapsed: number | null
  /** DM-Fox 等同步 API 返回的优化后提示词 */
  revisedPrompt?: string
  /** API 返回的 token 用量 */
  usage?: { input_tokens?: number; output_tokens?: number; images?: number }
}

// ===== API 请求/响应 =====

export interface ImageGenerationResponse {
  code?: number
  data?: Array<{
    status: string
    task_id: string
  }>
  error?: {
    code: number
    message: string
    type: string
  }
}

export interface TaskQueryResponse {
  code?: number
  data?: {
    id: string
    status: string
    progress: number
    actual_time: number
    result?: {
      images: Array<{
        url: string[]
        expires_at: number
      }>
    }
    error?: {
      code: number
      message: string
      type: string
    }
    fail_reason?: string
  }
  error?: {
    code: number
    message: string
    type: string
  }
}

// ===== 同步 API 响应（OpenAI 兼容格式，用于 DM-Fox 等供应商）=====

export interface ImageResponseItem {
  b64_json?: string
  url?: string
  revised_prompt?: string
}

export interface SyncImageApiResponse {
  created?: number
  data: ImageResponseItem[]
  model?: string
  usage?: {
    input_tokens?: number
    output_tokens?: number
    images?: number
  }
  error?: {
    code: number
    message: string
    type: string
  }
}

/** 同步 API 生成结果（含额外元信息） */
export interface SyncGenerationResult {
  images: string[]
  revisedPrompt?: string
  usage?: SyncImageApiResponse['usage']
}

export interface UploadImageResponse {
  url: string
  filename: string
  content_type: string
  bytes: number
  created_at: number
  error?: {
    message: string
    type: string
  }
}

// ===== 余额查询 =====

export interface BalanceResponse {
  success: boolean
  message?: string
  remain_balance?: number
  used_balance?: number
  unlimited_quota?: boolean
  error?: {
    type: string
  }
}

// ===== 尺寸映射 =====
export const RESOLUTION_MAP: Record<string, Record<string, string | null>> = {
  '1:1':  { '1k': '1024x1024', '2k': '2048x2048', '4k': null },
  '3:2':  { '1k': '1536x1024', '2k': '2048x1360', '4k': null },
  '2:3':  { '1k': '1024x1536', '2k': '1360x2048', '4k': null },
  '4:3':  { '1k': '1024x768',  '2k': '2048x1536', '4k': null },
  '3:4':  { '1k': '768x1024',  '2k': '1536x2048', '4k': null },
  '5:4':  { '1k': '1280x1024', '2k': '2560x2048', '4k': null },
  '4:5':  { '1k': '1024x1280', '2k': '2048x2560', '4k': null },
  '16:9': { '1k': '1536x864',  '2k': '2048x1152', '4k': '3840x2160' },
  '9:16': { '1k': '864x1536',  '2k': '1152x2048', '4k': '2160x3840' },
  '2:1':  { '1k': '2048x1024', '2k': '2688x1344', '4k': '3840x1920' },
  '1:2':  { '1k': '1024x2048', '2k': '1344x2688', '4k': '1920x3840' },
  '21:9': { '1k': '2016x864',  '2k': '2688x1152', '4k': '3840x1648' },
  '9:21': { '1k': '864x2016',  '2k': '1152x2688', '4k': '1648x3840' },
}

export const SUPPORTED_RATIOS = [
  'auto', '1:1', '3:2', '2:3', '4:3', '3:4', '5:4', '4:5',
  '16:9', '9:16', '2:1', '1:2', '21:9', '9:21',
]
