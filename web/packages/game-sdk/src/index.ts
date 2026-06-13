import { create } from 'zustand'

export type MessageType = 'ping' | 'pong' | 'join_game' | 'leave_game' | 'game_state' | 'player_action' | 'chat' | 'error' | 'match_found' | 'matchmaking'

export interface WSMessage {
  msg_type: MessageType
  game_id?: string
  player_id?: string
  payload: unknown
}

export interface GameState {
  tick: number
  players: PlayerInfo[]
  status: string
  winner?: string
}

export interface PlayerInfo {
  id: string
  name: string
  x: number
  y: number
  score: number
}

export interface GameStore {
  connected: boolean
  gameState: GameState | null
  playerId: string | null
  roomId: string | null
  messages: WSMessage[]
  ws: WebSocket | null
  connect: (url: string) => void
  disconnect: () => void
  send: (msg: WSMessage) => void
  joinGame: (gameType: string, playerName: string) => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  connected: false,
  gameState: null,
  playerId: null,
  roomId: null,
  messages: [],
  ws: null,

  connect: (url: string) => {
    const ws = new WebSocket(url)

    ws.onopen = () => {
      set({ connected: true })
    }

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data) as WSMessage
      set(state => ({ messages: [...state.messages, msg] }))

      if (msg.msg_type === 'match_found') {
        const payload = msg.payload as { room_id: string; player_id: string }
        set({ roomId: payload.room_id, playerId: payload.player_id })
      }

      if (msg.msg_type === 'game_state') {
        set({ gameState: msg.payload as GameState })
      }
    }

    ws.onclose = () => {
      set({ connected: false, ws: null })
    }

    set({ ws })
  },

  disconnect: () => {
    const { ws } = get()
    if (ws) {
      ws.close()
      set({ connected: false, ws: null })
    }
  },

  send: (msg: WSMessage) => {
    const { ws } = get()
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    }
  },

  joinGame: (gameType: string, playerName: string) => {
    const { send } = get()
    send({
      msg_type: 'join_game',
      payload: { game_type: gameType, player_name: playerName }
    })
  }
}))
