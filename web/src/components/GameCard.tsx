import { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface GameCardProps {
  id: string
  name: string
  players: string
  description: string
  icon: string
  gradient: string
  path: string
  playerName: string
}

export default function GameCard({ name, players, description, icon, gradient, path, playerName }: GameCardProps) {
  return (
    <div className="game-card rounded-3xl p-7 relative overflow-hidden group cursor-pointer">
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${gradient} opacity-10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500`}></div>
      
      <div className="relative z-10">
        <div className="game-icon text-6xl mb-5 drop-shadow-sm">
          {icon}
        </div>
        
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-xl font-bold text-gray-800 group-hover:text-primary-600 transition-colors">
            {name}
          </h3>
          <span className="player-count-badge px-3 py-1 rounded-full text-xs font-bold">
            {players} 人
          </span>
        </div>
        
        <p className="text-gray-500 text-sm mb-6 leading-relaxed">
          {description}
        </p>
        
        <Link
          to={`${path}?player=${encodeURIComponent(playerName)}`}
          className="btn-primary w-full text-center px-6 py-3 rounded-2xl font-bold text-white block"
        >
          开始游戏 →
        </Link>
      </div>
    </div>
  )
}
