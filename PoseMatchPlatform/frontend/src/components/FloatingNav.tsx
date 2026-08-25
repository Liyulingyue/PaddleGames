/**
 * 浮动导航：
 * 左上角：返回按钮（回主页）+ 当前模式信息（title/subtitle，可选）
 * 右上角：用户菜单
 * 替代传统 Navbar，更游戏化、无背景条
 */
import { Link } from 'react-router-dom'
import { ChevronLeft, HelpCircle } from 'lucide-react'
import UserMenu from './UserMenu'

interface FloatingNavProps {
  title?: string
  subtitle?: string
  /** 传入后右上角显示「指南」按钮（紧贴用户菜单左侧） */
  onHelpClick?: () => void
  /** 返回按钮目标路径，默认 "/" 回主页 */
  backTo?: string
  /** 返回按钮文字，默认 "回主页" */
  backLabel?: string
}

export default function FloatingNav({ title, subtitle, onHelpClick, backTo = '/', backLabel = '回主页' }: FloatingNavProps) {
  return (
    <>
      {/* 左上角：返回按钮 + 当前模式信息 */}
      <div className="fixed top-4 left-4 z-50 flex items-center gap-3">
        <Link
          to={backTo}
          className="flex items-center gap-1 px-3 py-2 rounded-xl bg-black/20 backdrop-blur-md border border-white/10 hover:bg-black/40 hover:border-white/20 transition-all group"
          title={backLabel}
        >
          <ChevronLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-sm hidden sm:inline">{backLabel}</span>
        </Link>
        {title && (
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold text-white hidden sm:inline">{title}</span>
            {subtitle && (
              <span className="text-[11px] text-white/50 hidden md:inline">{subtitle}</span>
            )}
          </div>
        )}
      </div>

      {/* 右上角：指南按钮（可选）+ 用户菜单 */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        {onHelpClick && (
          <button
            onClick={onHelpClick}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/20 backdrop-blur-md border border-white/10 hover:bg-black/40 hover:border-white/20 transition-all"
            aria-label="模式指南"
          >
            <HelpCircle size={18} />
            <span className="text-sm font-medium hidden sm:inline">指南</span>
          </button>
        )}
        <UserMenu variant="navbar" />
      </div>
    </>
  )
}
