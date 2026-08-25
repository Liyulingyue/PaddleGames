/**
 * 游戏化页面标题：渐变图标徽章 + 渐变文字 + 副标题
 * 统一全站页面顶部样式，替代 emoji 标题
 */
import type { LucideIcon } from 'lucide-react'

interface PageHeaderProps {
  icon: LucideIcon
  title: string
  subtitle?: string
  /** 渐变色，默认 blue→purple，与主菜单一致 */
  gradient?: string
  /** 图标徽章尺寸，默认 14（w-14 h-14） */
  iconSize?: number
  /** 标题字号，默认 text-4xl */
  titleSize?: string
  /** 右侧附加操作区（如按钮） */
  actions?: React.ReactNode
  className?: string
}

export default function PageHeader({
  icon: Icon,
  title,
  subtitle,
  gradient = 'from-emerald-400 to-cyan-500',
  iconSize = 28,
  titleSize = 'text-4xl',
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <div className={`flex items-center justify-between gap-4 mb-6 animate-fade-in-up ${className}`}>
      <div className="flex items-center gap-4">
        {/* 渐变图标徽章 */}
        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
          <Icon size={iconSize} className="text-white" />
        </div>
        <div>
          <h1 className={`font-black tracking-tight ${titleSize} bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
            {title}
          </h1>
          {subtitle && <p className="text-white/60 text-sm mt-1">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
