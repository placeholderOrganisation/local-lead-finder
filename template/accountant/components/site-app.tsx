"use client"

import { DesignSwitcher } from "@/components/design-switcher"
import { DarkAbout, DarkContact, DarkHome } from "@/components/designs/dark"
import { EmeraldAbout, EmeraldContact, EmeraldHome } from "@/components/designs/emerald"
import { SoftAbout, SoftContact, SoftHome } from "@/components/designs/soft"
import { readStoredDesign } from "@/lib/design"
import { useSite } from "@/lib/site-context"

export function SiteApp() {
  const { site, page, loading } = useSite()
  const design = readStoredDesign()

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-emerald-800/70">
        Loading preview…
      </div>
    )
  }

  const views =
    design === 2
      ? { home: DarkHome, about: DarkAbout, contact: DarkContact }
      : design === 3
        ? { home: SoftHome, about: SoftAbout, contact: SoftContact }
        : { home: EmeraldHome, about: EmeraldAbout, contact: EmeraldContact }

  const View = page === "about" ? views.about : page === "contact" ? views.contact : views.home

  return (
    <div className="min-h-screen">
      <DesignSwitcher />
      <View site={site} />
    </div>
  )
}
