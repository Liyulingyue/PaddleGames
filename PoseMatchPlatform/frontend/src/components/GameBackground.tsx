/**
 * 游戏化动态背景：渐变 + 浮动光晕 + 网格底纹
 * 用于所有页面统一视觉风格，与主菜单一致
 */
export default function GameBackground() {
  return (
    <>
      {/* 渐变底色 */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-slate-950 via-emerald-950/40 to-slate-950" />

      {/* 浮动光晕 */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[32rem] h-[32rem] bg-emerald-600/20 rounded-full blur-3xl animate-float-slow" />
        <div
          className="absolute bottom-1/4 right-1/4 w-[32rem] h-[32rem] bg-cyan-600/20 rounded-full blur-3xl animate-float-slow"
          style={{ animationDelay: '1.5s' }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[28rem] h-[28rem] bg-teal-600/10 rounded-full blur-3xl animate-float-slow"
          style={{ animationDelay: '0.8s' }}
        />
      </div>

      {/* 网格底纹 */}
      <div
        className="fixed inset-0 -z-10 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
    </>
  )
}
