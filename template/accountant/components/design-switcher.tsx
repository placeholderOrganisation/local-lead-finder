"use client"

import { useDesign, type DesignId } from "@/lib/design"

export function DesignSwitcher() {
  const { design, setDesign } = useDesign()
  return (
    <div className="fixed top-4 right-4 z-50 bg-white/90 backdrop-blur-md rounded-full shadow-lg p-1 flex gap-1">
      {([1, 2, 3] as DesignId[]).map((num) => (
        <button
          key={num}
          type="button"
          onClick={() => setDesign(num)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition ${
            design === num ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Design {num}
        </button>
      ))}
    </div>
  )
}
