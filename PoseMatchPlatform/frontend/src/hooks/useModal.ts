import { useEffect, useState, useRef } from 'react'

/**
 * 通用弹窗交互 hook：
 * - ESC 键关闭
 * - 打开时锁定 body 滚动，避免背景滚动穿透
 * - enter/exit 过渡动画状态（mounted 控制卸载时机，visible 触发 transition）
 *
 * 用法：
 *   const { mounted, visible } = useModal(open, onClose)
 *   if (!mounted) return null
 *   <div className={cn('transition-opacity', visible ? 'opacity-100' : 'opacity-0')} />
 */
export function useModal(open: boolean, onClose: () => void) {
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)
  // 稳定化 onClose，避免回调每次新建导致 ESC 监听反复绑解
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // enter/exit 动画状态
  useEffect(() => {
    if (open) {
      setMounted(true)
      // 双 rAF 确保浏览器先渲染初始态再触发 transition，避免跳过动画
      let raf2 = 0
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setVisible(true))
      })
      return () => {
        cancelAnimationFrame(raf1)
        cancelAnimationFrame(raf2)
      }
    } else {
      setVisible(false)
      const t = setTimeout(() => setMounted(false), 220)
      return () => clearTimeout(t)
    }
  }, [open])

  // ESC 关闭 + body 滚动锁定（依赖 open，回调走 ref 避免重绑）
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  return { mounted, visible }
}
