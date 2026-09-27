import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface ToastItem {
  id: number
  text: string
}

interface ToastApi {
  push: (text: string) => void
}

const ToastCtx = createContext<ToastApi>({ push: () => {} })

export function useToast(): ToastApi {
  return useContext(ToastCtx)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const push = useCallback((text: string) => {
    const id = ++counter.current
    setItems((cur) => [...cur, { id, text }])
    setTimeout(() => {
      setItems((cur) => cur.filter((t) => t.id !== id))
    }, 3800)
  }, [])

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="toast-layer">
        {items.map((t) => (
          <div className="toast" key={t.id}>{t.text}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
