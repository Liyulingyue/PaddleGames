import React from 'react'

export function Card({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      {title && <h3 className="text-lg font-semibold mb-2">{title}</h3>}
      {children}
    </div>
  )
}
