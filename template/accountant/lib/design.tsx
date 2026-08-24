"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

export type DesignId = 1 | 2 | 3

const KEY = "mockup.design"

type DesignContextValue = {
  design: DesignId
  setDesign: (id: DesignId) => void
}

const DesignContext = createContext<DesignContextValue | null>(null)

function readStored(): DesignId {
  if (typeof window === "undefined") return 1
  const n = Number(window.localStorage.getItem(KEY))
  return n === 2 || n === 3 ? n : 1
}

export function DesignProvider({ children }: { children: ReactNode }) {
  const [design, setDesignState] = useState<DesignId>(1)

  useEffect(() => {
    setDesignState(readStored())
  }, [])

  function setDesign(id: DesignId) {
    setDesignState(id)
    try {
      window.localStorage.setItem(KEY, String(id))
    } catch {
      /* ignore quota / private mode */
    }
  }

  return <DesignContext.Provider value={{ design, setDesign }}>{children}</DesignContext.Provider>
}

export function useDesign(): DesignContextValue {
  const ctx = useContext(DesignContext)
  if (!ctx) throw new Error("useDesign must be used within DesignProvider")
  return ctx
}
