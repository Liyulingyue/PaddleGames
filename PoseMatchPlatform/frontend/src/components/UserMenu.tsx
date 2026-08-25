import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { LogIn, LogOut, X, UserCircle, Shield, BookOpen, ChevronDown, Home, Heart } from 'lucide-react'
import { useUserStore } from '@/store/userStore'
import { cn } from '@/lib/utils'

interface UserMenuProps {
  /** 触发器样式变体：navbar（导航条胶囊）| menu（主菜单大按钮） */
  variant?: 'navbar' | 'menu'
}

export default function UserMenu({ variant = 'navbar' }: UserMenuProps) {
  const { user, isLoggedIn, login, logout } = useUserStore()
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [loginError, setLoginError] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogin = async () => {
    if (submitting) return
    if (!username.trim()) return setLoginError('请输入用户名')
    if (!password.trim()) return setLoginError('请输入密码')

    setSubmitting(true)
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || '登录失败')
      }
      const data = await res.json()
      login({
        id: data.id,
        username: data.username,
        nickname: data.nickname,
        avatar: data.avatar,
        isAdmin: data.is_admin,
      })
      closeModal()
    } catch (e: any) {
      setLoginError(e.message || '登录失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRegister = async () => {
    if (submitting) return
    if (!username.trim()) return setLoginError('请输入用户名')
    if (!password.trim()) return setLoginError('请输入密码（至少6位）')
    if (password.length < 6) return setLoginError('密码至少需要6位')
    if (!nickname.trim()) return setLoginError('请输入昵称')

    setSubmitting(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
          nickname: nickname.trim(),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || '注册失败')
      }
      const data = await res.json()
      login({
        id: data.id,
        username: data.username,
        nickname: data.nickname,
        avatar: data.avatar,
        isAdmin: data.is_admin,
      })
      closeModal()
    } catch (e: any) {
      setLoginError(e.message || '注册失败')
    } finally {
      setSubmitting(false)
    }
  }

  const closeModal = () => {
    setShowLoginModal(false)
    setUsername('')
    setPassword('')
    setNickname('')
    setLoginError('')
    setIsRegister(false)
  }

  // 触发器渲染
  const trigger = isLoggedIn ? (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setShowUserMenu(!showUserMenu)}
        className={cn(
          'flex items-center gap-2 rounded-full transition-all',
          variant === 'navbar'
            ? 'px-3 py-1.5 bg-white/10 hover:bg-white/20'
            : 'px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/15'
        )}
      >
        <UserCircle size={variant === 'navbar' ? 24 : 26} className="text-purple-400" />
        <span className="text-sm font-medium hidden sm:inline">{user.nickname}</span>
        <ChevronDown size={16} className={cn('text-white/50 transition-transform', showUserMenu && 'rotate-180')} />
      </button>
      {showUserMenu && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-slate-900/95 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl py-2 z-50">
          <Link
            to="/"
            onClick={() => setShowUserMenu(false)}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 transition-colors"
          >
            <Home size={18} className="text-white/60" />
            <span className="text-sm">回到首页</span>
          </Link>
          <Link
            to="/my-levels"
            onClick={() => setShowUserMenu(false)}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 transition-colors"
          >
            <BookOpen size={18} className="text-white/60" />
            <span className="text-sm">我的关卡</span>
          </Link>
          <Link
            to="/favorites"
            onClick={() => setShowUserMenu(false)}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 transition-colors"
          >
            <Heart size={18} className="text-white/60" />
            <span className="text-sm">我的收藏</span>
          </Link>
          <Link
            to="/poses"
            onClick={() => setShowUserMenu(false)}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 transition-colors text-amber-400"
          >
            <Shield size={18} className="text-amber-400/60" />
            <span className="text-sm">{user.isAdmin ? '管理中心' : '动作管理'}</span>
          </Link>
          <div className="my-1 border-t border-white/10" />
          <button
            onClick={() => { setShowUserMenu(false); logout() }}
            className="flex items-center gap-3 px-4 py-2.5 w-full hover:bg-white/10 transition-colors text-red-400"
          >
            <LogOut size={18} className="text-red-400/60" />
            <span className="text-sm">退出登录</span>
          </button>
        </div>
      )}
    </div>
  ) : (
    <button
      id="nav-login-btn"
      onClick={() => setShowLoginModal(true)}
      className={cn(
        'flex items-center gap-2 rounded-xl transition-all',
        variant === 'navbar'
          ? 'px-4 py-2 bg-gradient-to-r from-emerald-400 to-cyan-500 hover:shadow-lg hover:shadow-cyan-500/30'
          : 'px-5 py-2.5 bg-gradient-to-r from-emerald-400 to-cyan-500 hover:shadow-lg hover:shadow-cyan-500/40 backdrop-blur-md'
      )}
    >
      <LogIn size={variant === 'navbar' ? 18 : 20} />
      <span className="text-sm font-medium">登录</span>
    </button>
  )

  return (
    <>
      {trigger}
      {showLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/20 rounded-3xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">{isRegister ? '注册' : '登录'}</h2>
              <button onClick={closeModal} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-white/70 mb-2">用户名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setLoginError('') }}
                onKeyDown={(e) => { if (e.key === 'Enter') (isRegister ? handleRegister : handleLogin)() }}
                placeholder="输入用户名"
                maxLength={50}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:ring-2 focus:ring-cyan-500/50 focus:outline-none transition-all"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-white/70 mb-2">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setLoginError('') }}
                onKeyDown={(e) => { if (e.key === 'Enter') (isRegister ? handleRegister : handleLogin)() }}
                placeholder="输入密码（至少6位）"
                maxLength={100}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:ring-2 focus:ring-cyan-500/50 focus:outline-none transition-all"
              />
            </div>

            {isRegister && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-white/70 mb-2">昵称</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => { setNickname(e.target.value); setLoginError('') }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRegister() }}
                  placeholder="输入你的昵称"
                  maxLength={20}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:ring-2 focus:ring-cyan-500/50 focus:outline-none transition-all"
                />
              </div>
            )}

            {loginError && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-sm">
                {loginError}
              </div>
            )}

            <button
              onClick={isRegister ? handleRegister : handleLogin}
              disabled={submitting || !username.trim() || !password.trim() || (isRegister && !nickname.trim())}
              className={cn(
                'w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2',
                (username.trim() && password.trim() && (!isRegister || nickname.trim()))
                  ? 'bg-gradient-to-r from-emerald-400 to-cyan-500 hover:shadow-lg hover:shadow-cyan-500/30'
                  : 'bg-white/10 text-white/40 cursor-not-allowed'
              )}
            >
              {submitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
              {isRegister ? '注册' : '登录'}
            </button>

            <p className="mt-4 text-center">
              <button
                onClick={() => { setIsRegister(!isRegister); setLoginError('') }}
                className="text-purple-400 hover:text-purple-300 text-sm transition-colors"
              >
                {isRegister ? '已有账号？去登录' : '还没有账号？立即注册'}
              </button>
            </p>
          </div>
        </div>
      )}
    </>
  )
}
