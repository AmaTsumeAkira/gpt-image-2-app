import { RESOLUTION_MAP } from '../types'

const SIZE_PATTERN = /^\s*(\d+)\s*[xX×]\s*(\d+)\s*$/
const RATIO_ONLY_PATTERN = /^\s*(\d+)\s*:\s*(\d+)\s*$/
const RATIO_PATTERN = /^\s*(\d+(?:\.\d+)?)\s*[:xX×]\s*(\d+(?:\.\d+)?)\s*$/

export type SizeTier = '1K' | '2K' | '4K'

function roundToMultiple(value: number, multiple: number) {
  return Math.max(multiple, Math.round(value / multiple) * multiple)
}

export function normalizeImageSize(size: string) {
  const trimmed = size.trim()
  const match = trimmed.match(SIZE_PATTERN)
  if (!match) return trimmed

  const width = roundToMultiple(Number(match[1]), 16)
  const height = roundToMultiple(Number(match[2]), 16)
  return `${width}x${height}`
}

export function parseRatio(ratio: string) {
  const match = ratio.match(RATIO_PATTERN)
  if (!match) return null

  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null
  }

  return { width, height }
}

export function formatImageRatio(width: number, height: number) {
  const roundedWidth = Math.round(width)
  const roundedHeight = Math.round(height)
  if (
    !Number.isFinite(roundedWidth) ||
    !Number.isFinite(roundedHeight) ||
    roundedWidth <= 0 ||
    roundedHeight <= 0
  ) {
    return ''
  }

  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  const divisor = gcd(roundedWidth, roundedHeight)
  const simplifiedWidth = roundedWidth / divisor
  const simplifiedHeight = roundedHeight / divisor
  const simplified = `${simplifiedWidth}:${simplifiedHeight}`
  const commonRatios = [
    [1, 1], [4, 3], [3, 4], [3, 2], [2, 3],
    [16, 9], [9, 16], [21, 9], [9, 21],
  ]

  for (const [commonWidth, commonHeight] of commonRatios) {
    if (simplifiedWidth === commonWidth && simplifiedHeight === commonHeight) {
      return simplified
    }
  }

  const actualRatio = roundedWidth / roundedHeight
  const nearest = commonRatios
    .map(([commonWidth, commonHeight]) => ({
      label: `${commonWidth}:${commonHeight}`,
      delta: Math.abs(actualRatio - commonWidth / commonHeight) / (commonWidth / commonHeight),
    }))
    .sort((a, b) => a.delta - b.delta)[0]

  return nearest && nearest.delta <= 0.01 ? `≈${nearest.label}` : simplified
}

export function calculateImageSize(tier: SizeTier, ratio: string) {
  const parsed = parseRatio(ratio)
  if (!parsed) return null

  const { width: ratioWidth, height: ratioHeight } = parsed
  if (ratioWidth === ratioHeight) {
    const side = tier === '1K' ? 1024 : tier === '2K' ? 2048 : 3840
    return `${side}x${side}`
  }

  if (tier === '1K') {
    const shortSide = 1024
    const width = ratioWidth > ratioHeight
      ? roundToMultiple((shortSide * ratioWidth) / ratioHeight, 16)
      : shortSide
    const height = ratioWidth > ratioHeight
      ? shortSide
      : roundToMultiple((shortSide * ratioHeight) / ratioWidth, 16)
    return `${width}x${height}`
  }

  if (tier === '2K') {
    const shortSide = 2048
    const width = ratioWidth > ratioHeight
      ? roundToMultiple((shortSide * ratioWidth) / ratioHeight, 16)
      : shortSide
    const height = ratioWidth > ratioHeight
      ? shortSide
      : roundToMultiple((shortSide * ratioHeight) / ratioWidth, 16)
    return `${width}x${height}`
  }

  if (tier === '4K') {
    const shortSide = 3840
    const width = ratioWidth > ratioHeight
      ? roundToMultiple((shortSide * ratioWidth) / ratioHeight, 16)
      : shortSide
    const height = ratioWidth > ratioHeight
      ? shortSide
      : roundToMultiple((shortSide * ratioHeight) / ratioWidth, 16)
    return `${width}x${height}`
  }

  return null
}

/**
 * 将比例字符串（如 "16:9"）按分辨率档位转为像素尺寸（如 "2048x1152"）。
 * 如果 size 已是 WxH 像素格式，直接返回。
 * 如果无法转换（如 auto、未知比例），返回 null。
 */
export function ratioToPixels(size: string, resolution: string): string | null {
  // 已经是 WxH 格式
  if (SIZE_PATTERN.test(size)) return size

  // 比例格式
  const ratioMatch = size.match(RATIO_ONLY_PATTERN)
  if (!ratioMatch) return null

  const ratio = size.trim()
  const tier = resolution as '1k' | '2k' | '4k'
  const resolved = RESOLUTION_MAP[ratio]?.[tier]
  if (resolved) return resolved

  // 4k 不支持此比例时降级到 2k
  if (tier === '4k') {
    const fallback = RESOLUTION_MAP[ratio]?.['2k']
    if (fallback) return fallback
  }

  return calculateImageSize(tier.toUpperCase() as SizeTier, ratio) || null
}
