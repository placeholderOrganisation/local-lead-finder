"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  emptySiteConfig,
  normalizeSite,
  pageHref,
  parseLocation,
  type AppPage,
  type SiteConfig,
} from "@/lib/site-config"

type SiteContextValue = {
  site: SiteConfig
  placeId: string
  page: AppPage
  prefix: string
  loading: boolean
  href: (page: AppPage) => string
  go: (page: AppPage) => void
}

const SiteContext = createContext<SiteContextValue | null>(null)

export function SiteProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState("/")
  const [ready, setReady] = useState(false)
  const [site, setSite] = useState<SiteConfig>(() => emptySiteConfig())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const read = () => setPath(window.location.pathname)
    read()
    setReady(true)
    window.addEventListener("popstate", read)
    return () => window.removeEventListener("popstate", read)
  }, [])

  const loc = useMemo(() => parseLocation(path), [path])

  useEffect(() => {
    if (!ready) return
    const { placeId } = loc
    if (!placeId) {
      setSite(emptySiteConfig())
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(`/${placeId}/config.json`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`config ${res.status}`)
        return res.json()
      })
      .then((json) => {
        if (!cancelled) setSite(normalizeSite(json, placeId))
      })
      .catch(() => {
        if (!cancelled) setSite(emptySiteConfig(placeId))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [ready, loc.placeId])

  useEffect(() => {
    if (!ready) return
    const name = site.business.name
    if (name) document.title = `${name} | Preview`
  }, [ready, site.business.name])

  const go = useCallback(
    (page: AppPage) => {
      const to = pageHref(loc.prefix, page)
      if (window.location.pathname !== to) {
        window.history.pushState({}, "", to)
        setPath(to)
      }
    },
    [loc.prefix],
  )

  const value = useMemo<SiteContextValue>(
    () => ({
      site,
      placeId: loc.placeId,
      page: loc.page,
      prefix: loc.prefix,
      loading: !ready || loading,
      href: (page) => pageHref(loc.prefix, page),
      go,
    }),
    [site, loc.placeId, loc.page, loc.prefix, ready, loading, go],
  )

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>
}

export function useSite(): SiteContextValue {
  const ctx = useContext(SiteContext)
  if (!ctx) throw new Error("useSite must be used within SiteProvider")
  return ctx
}
