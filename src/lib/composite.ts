/**
 * 将多张参考图合成为一张拼图（用于 /v1/images/edits 单图输入）
 * 网格排列，每张保持原始宽高比，contain 模式完整显示，不足的地方留白。
 */
export async function compositeImages(
  dataUrls: string[],
  format: 'png' | 'jpeg' | 'webp' = 'png',
): Promise<string> {
  if (dataUrls.length === 0) throw new Error('No images to composite')
  if (dataUrls.length === 1) return dataUrls[0]

  const images = await Promise.all(
    dataUrls.map(
      (url) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image()
          img.onload = () => resolve(img)
          img.onerror = reject
          img.src = url
        }),
    ),
  )

  // 网格排列
  const count = images.length
  const cols = Math.ceil(Math.sqrt(count))
  const rows = Math.ceil(count / cols)

  // 以最大图片尺寸为 cell 基准，但不做放大（小图保持原尺寸居中）
  const cellW = Math.max(...images.map((i) => i.naturalWidth))
  const cellH = Math.max(...images.map((i) => i.naturalHeight))

  const canvas = document.createElement('canvas')
  canvas.width = cols * cellW
  canvas.height = rows * cellH
  const ctx = canvas.getContext('2d')!

  // 白色背景
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // 逐个绘制，contain 模式保持完整，居中放置
  for (let i = 0; i < count; i++) {
    const img = images[i]
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = col * cellW
    const y = row * cellH

    // contain 缩放：完整显示图片，不裁剪，缩小但不放大
    const scale = Math.min(cellW / img.naturalWidth, cellH / img.naturalHeight, 1)
    const sw = img.naturalWidth * scale
    const sh = img.naturalHeight * scale
    const sx = x + (cellW - sw) / 2
    const sy = y + (cellH - sh) / 2

    // 裁剪到单元格边界，防止浮点精度导致的 1px 溢出
    ctx.save()
    ctx.beginPath()
    ctx.rect(x, y, cellW, cellH)
    ctx.clip()
    ctx.drawImage(img, sx, sy, sw, sh)
    ctx.restore()
  }

  const mimeType =
    format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png'
  return canvas.toDataURL(mimeType, 0.92)
}
