"use client"

import type { MouseEvent, ReactNode } from "react"
import { useSite } from "@/lib/site-context"
import type { AppPage } from "@/lib/site-config"

export function PrefixLink({
  page,
  className,
  children,
}: {
  page: AppPage
  className?: string
  children: ReactNode
}) {
  const { href, go } = useSite()
  const to = href(page)

  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    go(page)
  }

  return (
    <a href={to} className={className} onClick={onClick}>
      {children}
    </a>
  )
}
