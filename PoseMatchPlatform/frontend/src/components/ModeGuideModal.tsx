import { useState, useEffect, useRef, type ReactNode } from 'react'
import { X, ChevronLeft, ChevronRight, Check, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useModal } from '@/hooks/useModal'

export interface GuideItem {
  label?: string
  desc: string
  /** 彩色小标签文字，如「达标」「Beta」「60s」 */
  tag?: string
  /** 标签配色 tailwind class，如 'bg-emerald-500/20 text-emerald-400' */
  tagColor?: string
}

export interface GuideSection {
  icon?: LucideIcon
  title: string
  desc?: string
  color?: string // 渐变色 tailwind class，如 'from-blue-500 to-cyan-500'
  /** 可视化图示（ReactNode），渲染在内容上方 */
  visual?: ReactNode
  items: GuideItem[]
}

interface ModeGuideModalProps {
  open: boolean
  onClose: () => void
  title: string
  emoji?: string
  subtitle?: string
  sections: GuideSection[]
  /** 分页模式：每次只展示一个 section，带翻页 + 进度指示（默认 true，section 数量 ≤1 时自动退化为单页） */
  paginated?: boolean
  /** 底部主按钮文字，默认「我知道了」 */
  confirmText?: string
}

/**
 * 各模式专属指南弹窗（单人/多人/沉浸 各自传入内容）
 * - 支持「分页模式」：sections 翻页展示，带进度点 + 上/下一页 + ← → 键盘翻页
 * - 支持 item 彩色 tag 标签
 * - 支持 section 可视化图示（visual）
 * - ESC 关闭 / enter-exit 动画 / body 滚动锁定 / 翻页滑动过渡
 */
export default function ModeGuideModal({
  open,
  onClose,
  title,
  emoji = '📖',
  subtitle,
  sections,
  paginated = true,
  confirmText = '我知道了',
}: ModeGuideModalProps) {
  const { mounted, visible } = useModal(open, onClose)
  // 分页模式仅在多 section 时启用
  const usePaging = paginated && sections.length > 1
  const [page, setPage] = useState(0)
  // 翻页方向：用于滑动动画方向（next 向左滑、prev 向右滑）
  const [dir, setDir] = useState<'next' | 'prev'>('next')
  const confirmBtnRef = useRef<HTMLButtonElement>(null)

  // 翻页辅助：记录方向并切页
  const goPage = (next: number) => {
    setPage((cur) => {
      if (next === cur) return cur
      setDir(next > cur ? 'next' : 'prev')
      return next
    })
  }
  const next = () => goPage(Math.min(sections.length - 1, page + 1))
  const prev = () => goPage(Math.max(0, page - 1))

  // 打开时重置到第一页
  useEffect(() => {
    if (open) {
      setPage(0)
      setDir('next')
    }
  }, [open])

  // ← → 键翻页（仅分页模式）
  useEffect(() => {
    if (!open || !usePaging) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); next() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, usePaging, page, sections.length])

  // 末页自动聚焦确认按钮（无障碍 + 回车可直接关闭）
  useEffect(() => {
    if (open && usePaging && page === sections.length - 1) {
      // 延迟一帧等按钮渲染
      const raf = requestAnimationFrame(() => confirmBtnRef.current?.focus())
      return () => cancelAnimationFrame(raf)
    }
  }, [open, usePaging, page, sections.length])

  if (!mounted) return null

  const isLast = page >= sections.length - 1

  return (
    <div
      className={cn(
        'fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 transition-opacity duration-200',
        visible ? 'opacity-100' : 'opacity-0'
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          'bg-slate-900/95 border border-white/20 rounded-3xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden transition-all duration-200',
          visible ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl flex-shrink-0">{emoji}</span>
            <div className="min-w-0">
              <h2 className="text-xl font-bold truncate">{title}</h2>
              {subtitle && <p className="text-xs text-white/50 mt-0.5 truncate">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
            aria-label="关闭"
          >
            <X size={20} />
          </button>
        </div>

        {/* 分页进度指示 */}
        {usePaging && (
          <div className="flex items-center justify-center gap-1.5 px-6 py-2.5 border-b border-white/5">
            {sections.map((s, i) => (
              <button
                key={i}
                onClick={() => goPage(i)}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === page ? 'w-6 bg-gradient-to-r from-emerald-400 to-cyan-400' : 'w-1.5 bg-white/20 hover:bg-white/40'
                )}
                aria-label={`第 ${i + 1} 节：${s.title}`}
                title={s.title}
              />
            ))}
          </div>
        )}

        {/* 内容区：分页模式下固定最小高度，避免翻页时框体跳动 */}
        <div className={cn('flex-1 overflow-y-auto p-6', usePaging && 'min-h-[420px]')}>
          {usePaging ? (
            // key + dir 驱动滑动动画：每次 page 变化重新挂载触发 fadeInSlide
            <div
              key={page}
              className={cn(
                'animate-[guideSlide_0.25s_ease-out]',
                dir === 'next' ? '[--slide-from:12px]' : '[--slide-from:-12px]'
              )}
            >
              <SectionView section={sections[page]} index={page} total={sections.length} />
            </div>
          ) : (
            <div className="space-y-4">
              {sections.map((s, i) => (
                <SectionView key={i} section={s} />
              ))}
            </div>
          )}
        </div>

        {/* 底部操作区 */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-white/10 bg-white/5">
          {usePaging ? (
            <>
              <button
                onClick={prev}
                disabled={page === 0}
                className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
                上一页
              </button>
              <span className="text-xs text-white/50 tabular-nums">{page + 1} / {sections.length}</span>
              {isLast ? (
                <button
                  ref={confirmBtnRef}
                  onClick={onClose}
                  className="flex items-center gap-1 px-5 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-400 to-cyan-500 hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
                >
                  <Check size={16} />
                  {confirmText}
                </button>
              ) : (
                <button
                  onClick={next}
                  className="flex items-center gap-1 px-5 py-2 rounded-xl text-sm font-bold bg-white/10 hover:bg-white/20 transition-all"
                >
                  下一页
                  <ChevronRight size={16} />
                </button>
              )}
            </>
          ) : (
            <>
              <span className="text-xs text-white/50">按 ESC 或点击遮罩关闭</span>
              <button
                onClick={onClose}
                className="flex items-center gap-1 px-5 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-400 to-cyan-500 hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
              >
                <Check size={16} />
                {confirmText}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** 单个 section 渲染 */
function SectionView({
  section,
  index,
  total,
}: {
  section: GuideSection
  index?: number
  total?: number
}) {
  const Icon = section.icon
  return (
    <div className="space-y-4">
      {/* 标题行 */}
      <div className="flex items-center gap-3">
        {Icon && section.color && (
          <div className={cn('w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center flex-shrink-0 shadow-lg', section.color)}>
            <Icon size={24} className="text-white" />
          </div>
        )}
        <div className="min-w-0">
          {typeof index === 'number' && typeof total === 'number' && (
            <span className="text-[10px] text-white/50 font-mono">第 {index + 1} / {total} 节</span>
          )}
          <h3 className="text-lg font-bold leading-tight">{section.title}</h3>
          {section.desc && <p className="text-xs text-white/50 mt-0.5">{section.desc}</p>}
        </div>
      </div>

      {/* 可视化图示 */}
      {section.visual && (
        <div className="rounded-2xl bg-black/20 border border-white/10 p-4">
          {section.visual}
        </div>
      )}

      {/* 要点列表 */}
      <ul className="space-y-2.5">
        {section.items.map((item, j) => (
          <li key={j} className="flex items-start gap-2.5 text-sm">
            <span className="text-white/50 mt-1.5 flex-shrink-0">
              <span className="block w-1.5 h-1.5 rounded-full bg-current" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {item.label && (
                  <span className="text-white/90 font-semibold">{item.label}</span>
                )}
                {item.tag && (
                  <span className={cn(
                    'px-1.5 py-0.5 rounded-md text-[10px] font-bold',
                    item.tagColor || 'bg-white/10 text-white/70'
                  )}>
                    {item.tag}
                  </span>
                )}
              </div>
              <p className="text-white/75 leading-relaxed mt-0.5">{item.desc}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
