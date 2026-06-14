import { create } from 'zustand'

interface WSMessage {
  msg_type: string
  game_id?: string
  player_id?: string
  payload: unknown
}

interface GameStore {
  connected: boolean
  playerName: string
  roomId: string | null
  playerId: string | null
  ws: WebSocket | null
  latency: number | null
  connect: (playerName: string) => void
  disconnect: () => void
  send: (msg: WSMessage) => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  connected: false,
  playerName: '',
  roomId: null,
  playerId: null,
  ws: null,
  latency: null,

  connect: (playerName: string) => {
    const existingWs = get().ws
    if (existingWs?.readyState === WebSocket.OPEN) {
      return
    }

    const ws = new WebSocket('ws://localhost:7080/ws')
    let lastPing = 0

    ws.onopen = () => {
      set({ connected: true, ws, playerName })
    }

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data)
        
        if (msg.msg_type === 'pong') {
          const payload = msg.payload as { timestamp?: number }
          if (payload.timestamp) {
            set({ latency: Date.now() - payload.timestamp })
          }
        }
        
        if (msg.msg_type === 'match_found') {
          const payload = msg.payload as { room_id: string; player_id: string }
          set({ roomId: payload.room_id, playerId: payload.player_id })
        }
      } catch {
        console.error('Failed to parse message')
      }
    }

    ws.onclose = () => {
      set({ connected: false, ws: null, roomId: null, playerId: null, latency: null })
    }

    ws.onerror = () => {
      set({ connected: false })
    }

    set({ ws })

    setInterval(() => {
      const currentWs = get().ws
      if (currentWs?.readyState === WebSocket.OPEN) {
        lastPing = Date.now()
        currentWs.send(JSON.stringify({ msg_type: 'ping', payload: { timestamp: lastPing } }))
      }
    }, 3000)
  },

  disconnect: () => {
    const { ws } = get()
    if (ws) {
      ws.close()
    }
    set({ connected: false, ws: null, roomId: null, playerId: null, latency: null })
  },

  send: (msg: WSMessage) => {
    const { ws } = get()
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    }
  },
}))
