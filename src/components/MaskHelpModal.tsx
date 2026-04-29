import { useStore } from '../store'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'

export default function MaskHelpModal() {
  const showMaskHelp = useStore((s) => s.showMaskHelp)
  const setShowMaskHelp = useStore((s) => s.setShowMaskHelp)

  useCloseOnEscape(showMaskHelp, () => setShowMaskHelp(false))

  if (!showMaskHelp) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setShowMaskHelp(false)}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-overlay-in" />
      <div
        className="relative z-10 w-full max-w-md rounded-3xl border border-white/50 bg-white/95 p-5 shadow-2xl ring-1 ring-black/5 animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-800">🖌️ 局部重绘</h3>
          <button onClick={() => setShowMaskHelp(false)} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
          <section>
            <h4 className="font-semibold text-gray-800 mb-1">什么是遮罩？</h4>
            <p>遮罩用来标记图片中<strong>要重新生成</strong>的区域。编辑器中参考图会作为背景显示，用<strong>红色画笔</strong>涂抹需要重绘的部分即可。</p>
          </section>

          <section>
            <h4 className="font-semibold text-gray-800 mb-1">使用步骤</h4>
            <ol className="list-decimal list-inside space-y-1">
              <li>上传一张<strong>参考图</strong>（即原始图片）</li>
              <li>用<strong>画笔</strong>（红色）涂抹要重绘的区域，<strong>橡皮</strong>清除误涂</li>
              <li>输入<strong>提示词</strong>描述涂抹区域要生成的内容</li>
              <li>点击<strong>保存遮罩</strong>，然后<strong>生成</strong></li>
            </ol>
          </section>

          <section className="bg-purple-50 rounded-xl p-3">
            <h4 className="font-semibold text-gray-800 mb-1">示例</h4>
            <p className="text-gray-700">提示词：<em>"把背景换成沙漠日落"</em></p>
            <ul className="mt-1 space-y-0.5 text-xs text-gray-500">
              <li>📷 参考图：人物照片</li>
              <li> 用红色画笔涂抹背景区域</li>
              <li>✅ 结果：人物不变，背景变成沙漠日落</li>
            </ul>
          </section>

          <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-2 border border-gray-100">
            ⚠️ 遮罩图尺寸必须与首张参考图完全一致。红色涂抹 = 重绘区域，透明 = 保留区域。
          </div>
        </div>
      </div>
    </div>
  )
}
