import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import PoseSnake1 from './pages/games/PoseSnake1'
import PoseSnake2 from './pages/games/PoseSnake2'
import PoseMatch from './pages/games/PoseMatch'
import PoseCars from './pages/games/PoseCars'
import RLBattle from './pages/games/RLBattle'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/games/pose-snake" element={<PoseSnake1 />} />
        <Route path="/games/pose-snake-2" element={<PoseSnake2 />} />
        <Route path="/games/pose-match" element={<PoseMatch />} />
        <Route path="/games/pose-cars" element={<PoseCars />} />
        <Route path="/games/rl-battle" element={<RLBattle />} />
      </Routes>
    </BrowserRouter>
  )
}
