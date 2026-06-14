interface ConnectionStatusProps {
  connected: boolean
  roomId?: string | null
}

export default function ConnectionStatus({ connected, roomId }: ConnectionStatusProps) {
  return (
    <div className="flex flex-col items-center">
      <span className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold ${
        connected 
          ? 'badge-success' 
          : 'badge-disconnected'
      }`}>
        {connected ? '🟢 已连接' : '🔴 未连接'}
      </span>
      {connected && roomId && (
        <span className="text-xs text-gray-500 mt-1.5 font-medium">房间: {roomId.slice(0, 8)}</span>
      )}
    </div>
  )
}
