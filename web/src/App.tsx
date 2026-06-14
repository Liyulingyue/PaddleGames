import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import PoseSnake1 from './pages/games/PoseSnake1'
import PoseSnake2 from './pages/games/PoseSnake2'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/games/pose-snake" element={<PoseSnake1 />} />
        <Route path="/games/pose-snake-2" element={<PoseSnake2 />} />
      </Routes>
    </BrowserRouter>
  )
}
