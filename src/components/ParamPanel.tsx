import { useRef, useEffect, useCallback, useState } from 'react'
import { useStore, addImageFromFile } from '../store'
import { DEFAULT_PARAMS } from '../types'
import Select from './Select'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'

const SIZE_PATTERN = /^\s*(\d+)\s*[xX×]\s*(\d+)\s*$/
const PRESET_RATIOS = [
  'auto', '1:1', '3:2', '2:3', '4:3', '3:4', '5:4', '4:5',
  '16:9', '9:16', '2:1', '1:2', '21:9', '9:21',
]

function SizeInput({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const isCustom = value && !PRESET_RATIOS.includes(value)
  const [mode, setMode] = useState<'preset' | 'custom'>(isCustom ? 'custom' : 'preset')
  const parsed = value.match(SIZE_PATTERN)
  const [customW, setCustomW] = useState(parsed ? parsed[1] : '1024')
  const [customH, setCustomH] = useState(parsed ? parsed[2] : '1024')

  const commitCustom = () => {
    const w = parseInt(customW, 10)
    const h = parseInt(customH, 10)
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      onChange(`${w}x${h}`)
    }
  }

  const baseClass =
    'px-3 py-1.5 rounded-xl border border-gray-200/60 bg-white/50 hover:bg-white text-xs transition-all duration-200 shadow-sm w-full'

  if (mode === 'custom') {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <input
            value={customW}
            onChange={(e) => setCustomW(e.target.value)}
            onBlur={commitCustom}
            type="number"
            min={64}
            max={7680}
            className="w-full px-2 py-1.5 rounded-xl border border-gray-200/60 bg-white/50 focus:outline-none text-xs text-center transition-all duration-200 shadow-sm"
            placeholder="宽"
          />
          <span className="text-gray-300 text-xs">×</span>
          <input
            value={customH}
            onChange={(e) => setCustomH(e.target.value)}
            onBlur={commitCustom}
            type="number"
            min={64}
            max={7680}
            className="w-full px-2 py-1.5 rounded-xl border border-gray-200/60 bg-white/50 focus:outline-none text-xs text-center transition-all duration-200 shadow-sm"
            placeholder="高"
          />
          <button
            onClick={() => { setMode('preset'); onChange('auto') }}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
            title="切换为预设比例"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  return (
    <select
      value={PRESET_RATIOS.includes(value) ? value : 'auto'}
      onChange={(e) => {
        if (e.target.value === '__custom__') setMode('custom')
        else onChange(e.target.value)
      }}
      className={baseClass}
    >
      {PRESET_RATIOS.map((r) => (
        <option key={r} value={r}>
          {r === 'auto' ? '自动' : r}
        </option>
      ))}
      <option value="__custom__">自定义像素</option>
    </select>
  )
}

/** 参数标签行 */
function ParamRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-gray-500 w-16 flex-shrink-0">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

/** 遮罩图帮助弹窗 */
function MaskHelpButton() {
  const [open, setOpen] = useState(false)

  useCloseOnEscape(open, () => setOpen(false))

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        className="w-3.5 h-3.5 rounded-full bg-gray-200 text-gray-500 text-[9px] font-bold flex items-center justify-center hover:bg-purple-200 hover:text-purple-600 transition-colors"
        title="查看遮罩图使用说明"
      >
        ?
      </button>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-overlay-in" />
          <div
            className="relative z-10 w-full max-w-md rounded-3xl border border-white/50 bg-white/95 p-5 shadow-2xl ring-1 ring-black/5 animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-800">🖌️ 局部重绘</h3>
              <button onClick={() => setOpen(false)} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
              <section>
                <h4 className="font-semibold text-gray-800 mb-1">什么是遮罩？</h4>
                <p>遮罩是一张灰度图片，白色区域表示<strong>"要重新生成"</strong>，黑色区域表示<strong>"保留原样"</strong>。</p>
              </section>

              <section>
                <h4 className="font-semibold text-gray-800 mb-1">使用步骤</h4>
                <ol className="list-decimal list-inside space-y-1">
                  <li>上传一张<strong>参考图</strong>（即原始图片）</li>
                  <li>上传一张<strong>遮罩图</strong>（白色 = 要改的区域）</li>
                  <li>输入<strong>提示词</strong>描述遮罩区域要生成的内容</li>
                  <li>点击<strong>生成</strong></li>
                </ol>
              </section>

              <section className="bg-purple-50 rounded-xl p-3">
                <h4 className="font-semibold text-gray-800 mb-1">示例</h4>
                <p className="text-gray-700">提示词：<em>"把背景换成沙漠日落"</em></p>
                <ul className="mt-1 space-y-0.5 text-xs text-gray-500">
                  <li>📷 参考图：人物照片</li>
                  <li>🎭 遮罩图：背景区域为白色，人物为黑色</li>
                  <li>✅ 结果：人物不变，背景变成沙漠日落</li>
                </ul>
              </section>

              <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-2 border border-gray-100">
                ⚠️ 遮罩图需含 Alpha 通道，且尺寸必须与首张参考图完全一致
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function ParamPanel() {
  const settings = useStore((s) => s.settings)
  const inputImages = useStore((s) => s.inputImages)
  const removeInputImage = useStore((s) => s.removeInputImage)
  const clearInputImages = useStore((s) => s.clearInputImages)
  const maskImage = useStore((s) => s.maskImage)
  const setMaskImage = useStore((s) => s.setMaskImage)
  const clearMaskImage = useStore((s) => s.clearMaskImage)
  const params = useStore((s) => s.params)
  const setParams = useStore((s) => s.setParams)
  const setLightboxImageUrl = useStore((s) => s.setLightboxImageUrl)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)
  const setShowPhotoLibrary = useStore((s) => s.setShowPhotoLibrary)
  const showToast = useStore((s) => s.showToast)

  const isApimart = settings.provider === 'apimart'
  const isDmfox = settings.provider === 'dmfox'

  const [outputCompressionInput, setOutputCompressionInput] = useState(
    params.output_compression == null ? '' : String(params.output_compression),
  )
  const [nInput, setNInput] = useState(String(params.n))
  const fileInputRef = useRef<HTMLInputElement>(null)
  const maskFileInputRef = useRef<HTMLInputElement>(null)

  const atImageLimit = inputImages.length >= 16

  useEffect(() => {
    setOutputCompressionInput(params.output_compression == null ? '' : String(params.output_compression))
  }, [params.output_compression])

  useEffect(() => {
    setNInput(String(params.n))
  }, [params.n])

  const commitOutputCompression = useCallback(() => {
    if (outputCompressionInput.trim() === '') {
      setOutputCompressionInput('')
      setParams({ output_compression: null })
      return
    }
    const nextValue = Number(outputCompressionInput)
    if (Number.isNaN(nextValue)) {
      setOutputCompressionInput(params.output_compression == null ? '' : String(params.output_compression))
      return
    }
    setOutputCompressionInput(String(nextValue))
    setParams({ output_compression: nextValue })
  }, [outputCompressionInput, params.output_compression, setParams])

  const commitN = useCallback(() => {
    const nextValue = Number(nInput)
    const normalizedValue =
      nInput.trim() === '' ? DEFAULT_PARAMS.n : Number.isNaN(nextValue) ? params.n : nextValue
    setNInput(String(normalizedValue))
    setParams({ n: normalizedValue })
  }, [nInput, params.n, setParams])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue
        await addImageFromFile(file)
      }
    } catch (err) {
      showToast(`图片添加失败：${err instanceof Error ? err.message : String(err)}`, 'error')
    }
    e.target.value = ''
  }

  const handleMaskUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('请选择图片文件作为遮罩', 'error')
      return
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)
      setMaskImage({ id, dataUrl })
      showToast('遮罩图已添加（需配合参考图使用）', 'info')
    } catch {
      showToast('遮罩图读取失败', 'error')
    }
    e.target.value = ''
  }

  const selectClass =
    'px-3 py-1.5 rounded-xl border border-gray-200/60 bg-white/50 hover:bg-white text-xs transition-all duration-200 shadow-sm w-full'

  return (
    <div className="flex flex-col gap-5">
      {/* DM-Fox 提示 */}
      {isDmfox && !inputImages.length && (
        <section>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-700 leading-relaxed">
            <strong>同步模式</strong> — 提交后直接返回图片，无需轮询等待。
            添加参考图可切换到图生图/图片编辑模式。
          </div>
        </section>
      )}

      {/* 参考图（两个供应商均支持） */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-medium text-gray-500">参考图</h4>
          <div className="flex items-center gap-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={atImageLimit}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-30"
              title="上传参考图"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              onClick={() => setShowPhotoLibrary(true)}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="从图片库选择"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>
        {inputImages.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {inputImages.map((img, idx) => (
              <div key={img.id} className="relative group">
                <img
                  src={img.dataUrl}
                  className="w-12 h-12 rounded-lg object-cover border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setLightboxImageUrl(img.dataUrl, inputImages.map((i) => i.dataUrl))}
                  alt=""
                />
                <button
                  onClick={() => removeInputImage(idx)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
                >
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            {inputImages.length > 0 && (
              <button
                onClick={() =>
                  setConfirmDialog({
                    title: '清空参考图',
                    message: `确定要清空全部 ${inputImages.length} 张参考图吗？`,
                    action: () => clearInputImages(),
                  })
                }
                className="w-12 h-12 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-300 hover:bg-red-50/50 transition-all"
                title="清空全部"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border border-dashed border-gray-200 rounded-lg py-3 flex flex-col items-center gap-1 cursor-pointer hover:border-gray-300 hover:bg-gray-50/50 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-[10px] text-gray-400">点击添加上传或从图片库选择</span>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} />
      </section>

      {/* DM-Fox 提示：当同时有参考图时 */}
      {isDmfox && inputImages.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 text-[10px] text-blue-600 leading-relaxed">
          参考图将作为 <code className="bg-blue-100/50 px-1 rounded">image</code> 参数发送，实现图生图编辑。
        </div>
      )}

      {/* 遮罩图（局部重绘）- 仅 APIMart */}
      {isApimart && <section>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-medium text-gray-500 flex items-center gap-1">
            遮罩图
            <span className="text-[10px] text-gray-300 font-normal">(局部重绘)</span>
            {/* 帮助按钮 */}
            <MaskHelpButton />
          </h4>
          {maskImage && (
            <button onClick={clearMaskImage} className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="清除遮罩">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
        {maskImage ? (
          <div className="relative group inline-block">
            <img src={maskImage.dataUrl} className="w-16 h-16 rounded-lg object-cover border border-purple-300 shadow-sm" alt="遮罩" />
            <button
              onClick={clearMaskImage}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <div
            onClick={() => maskFileInputRef.current?.click()}
            className="border border-dashed border-gray-200 rounded-lg py-2.5 flex flex-col items-center gap-1 cursor-pointer hover:border-purple-300 hover:bg-purple-50/50 transition-colors"
          >
            <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span className="text-[10px] text-gray-400">点击上传遮罩图（需含 Alpha 通道）</span>
          </div>
        )}
        {/* 使用说明 */}
        {inputImages.length > 0 && maskImage && (
          <div className="mt-2 p-2 bg-purple-50/50 border border-purple-100 rounded-lg">
            <p className="text-[10px] text-purple-600 leading-relaxed">
              遮罩图尺寸需与首张参考图一致。白色区域将被重绘，黑色区域保留原图。
            </p>
          </div>
        )}
        {inputImages.length === 0 && maskImage && (
          <div className="mt-1 text-[10px] text-amber-500">需同时添加参考图才能使用局部重绘</div>
        )}
        <input ref={maskFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleMaskUpload} />
      </section>}

      {/* 分隔线 */}
      <div className="border-t border-gray-100" />

      {/* 生成参数 */}
      <section className="space-y-3">
        <h4 className="text-xs font-medium text-gray-500">生成参数</h4>

        <ParamRow label="尺寸">
          <SizeInput value={params.size} onChange={(val) => setParams({ size: val })} />
        </ParamRow>

        <ParamRow label="分辨率">
          <Select
            value={params.resolution}
            onChange={(val) => setParams({ resolution: val as any })}
            options={[
              { label: '1K (1024)', value: '1k' },
              { label: '2K (2048)', value: '2k' },
              { label: '4K (3840)', value: '4k' },
            ]}
            className={selectClass}
          />
        </ParamRow>

        <ParamRow label="质量">
          <Select
            value={params.quality}
            onChange={(val) => setParams({ quality: val as any })}
            options={[
              { label: '自动', value: 'auto' },
              { label: '低 (快速)', value: 'low' },
              { label: '中 (平衡)', value: 'medium' },
              { label: '高 (精细)', value: 'high' },
            ]}
            className={selectClass}
          />
        </ParamRow>

        <ParamRow label="格式">
          <Select
            value={params.output_format}
            onChange={(val) => setParams({ output_format: val as any })}
            options={[
              { label: 'PNG', value: 'png' },
              { label: 'JPEG', value: 'jpeg' },
              { label: 'WebP', value: 'webp' },
            ]}
            className={selectClass}
          />
        </ParamRow>

        <ParamRow label="压缩">
          <input
            value={outputCompressionInput}
            onChange={(e) => setOutputCompressionInput(e.target.value)}
            onBlur={commitOutputCompression}
            disabled={params.output_format === 'png'}
            type="number"
            min={0}
            max={100}
            placeholder="0-100"
            className={`w-full px-3 py-1.5 rounded-xl border border-gray-200/60 focus:outline-none text-xs transition-all duration-200 shadow-sm ${
              params.output_format === 'png'
                ? 'bg-gray-100/50 opacity-50 cursor-not-allowed'
                : 'bg-white/50'
            }`}
          />
        </ParamRow>

        <ParamRow label="审核">
          <Select
            value={params.moderation}
            onChange={(val) => setParams({ moderation: val as any })}
            options={[
              { label: 'auto (默认)', value: 'auto' },
              { label: 'low (宽松)', value: 'low' },
            ]}
            className={selectClass}
          />
        </ParamRow>

        <ParamRow label="数量">
          <input
            value={nInput}
            onChange={(e) => setNInput(e.target.value)}
            onBlur={commitN}
            type="number"
            min={1}
            max={4}
            className="w-full px-3 py-1.5 rounded-xl border border-gray-200/60 bg-white/50 focus:outline-none text-xs transition-all duration-200 shadow-sm"
          />
        </ParamRow>
      </section>
    </div>
  )
}
