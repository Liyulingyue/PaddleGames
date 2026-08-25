import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import LoadingScreen from './components/LoadingScreen'
import MainMenu from './components/MainMenu'
import SinglePlayer from './pages/SinglePlayer'
import Play from './pages/Play'
import VideoImport from './pages/VideoImport'
import MultiPlayer from './pages/MultiPlayer'
import Leaderboard from './pages/Leaderboard'
import Room from './pages/Room'
import ImmersiveMode from './pages/ImmersiveMode'
import MyLevels from './pages/MyLevels'
import Marketplace from './pages/Marketplace'
import MyFavorites from './pages/MyFavorites'
import { AdminPoses } from './pages/AdminPoses'

const BOOT_KEY = 'posematch-booted'

function App() {
  // 是否已通过开屏加载（同一会话内刷新不再重走 LoadingScreen）
  const [booted, setBooted] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(BOOT_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (booted) {
      try {
        sessionStorage.setItem(BOOT_KEY, '1')
      } catch {}
    }
  }, [booted])

  if (!booted) {
    return (
      <LoadingScreen
        onComplete={() => {
          try {
            sessionStorage.setItem(BOOT_KEY, '1')
          } catch {}
          setBooted(true)
        }}
      />
    )
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900">
        <Routes>
          <Route path="/" element={<MainMenu />} />
          <Route path="/single" element={<SinglePlayer />} />
          <Route path="/play" element={<Play />} />
          <Route path="/import" element={<VideoImport />} />
          <Route path="/my-levels" element={<MyLevels />} />
          <Route path="/market" element={<Marketplace />} />
          <Route path="/favorites" element={<MyFavorites />} />
          <Route path="/multi" element={<MultiPlayer />} />
          <Route path="/room/:roomCode" element={<Room />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/immersive" element={<ImmersiveMode />} />
          <Route path="/poses" element={<AdminPoses />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
