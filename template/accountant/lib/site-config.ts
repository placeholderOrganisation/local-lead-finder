/** Runtime lead config — same shape as CRM `lead.mockup.config` / former window.SITE. */

export type SiteService = { title: string; desc: string }
export type SiteFaq = { q: string; a: string }
export type SiteReview = {
  author: string
  rating: number
  text: string
  relativeTime: string
}

export type SiteConfig = {
  business: {
    name: string
    category: string
    phone: string
    tel: string
    address: string
    mapsUrl: string
    area: string
    rating: number | null
    reviewCount: number | null
  }
  copy: {
    heroHeadline: string
    heroSub: string
    about: string
    services: SiteService[]
    faq: SiteFaq[]
  }
  reviews: SiteReview[]
  meta: {
    preview: boolean
    generatedAt: string | null
    placeId: string
    model?: string
  }
}

export type AppPage = "home" | "about" | "contact"

const APP_PAGES = new Set(["about", "contact"])
const SKIP_FIRST = new Set(["_next", "preview"])

export function emptySiteConfig(placeId = ""): SiteConfig {
  return {
    business: {
      name: "Preview example",
      category: "",
      phone: "",
      tel: "",
      address: "",
      mapsUrl: "",
      area: "",
      rating: null,
      reviewCount: null,
    },
    copy: {
      heroHeadline: "Preview / mockup",
      heroSub: "No config yet — generate a mockup to personalize this template.",
      about: "",
      services: [],
      faq: [],
    },
    reviews: [],
    meta: { preview: true, generatedAt: null, placeId },
  }
}

/**
 * placeId is the first path segment. A leading `preview` is skipped so the
 * dashboard can serve this export at `/preview/{placeId}/`.
 */
export function parseLocation(pathname: string): { placeId: string; page: AppPage; prefix: string } {
  const segs = pathname.split("/").filter(Boolean)
  if (segs[0] === "preview") segs.shift()

  if (segs.length === 0) {
    return { placeId: "", page: "home", prefix: "" }
  }

  const first = segs[0]
  if (!first || first.includes(".") || SKIP_FIRST.has(first)) {
    return { placeId: "", page: "home", prefix: "" }
  }

  if (APP_PAGES.has(first)) {
    return { placeId: "", page: first as AppPage, prefix: "" }
  }

  const placeId = first
  const second = segs[1] || ""
  const page: AppPage = second === "about" || second === "contact" ? second : "home"
  return { placeId, page, prefix: `/${placeId}` }
}

export function pageHref(prefix: string, page: AppPage): string {
  if (page === "home") return prefix ? `${prefix}/` : "/"
  return prefix ? `${prefix}/${page}/` : `/${page}/`
}

function str(v: unknown): string {
  return v == null ? "" : String(v)
}

function numOrNull(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Accept the CRM object; tolerate minor key aliases from older configs. */
export function normalizeSite(raw: unknown, placeId = ""): SiteConfig {
  const empty = emptySiteConfig(placeId)
  if (!raw || typeof raw !== "object") return empty
  const s = raw as Record<string, unknown>
  const b = (s.business && typeof s.business === "object" ? s.business : {}) as Record<string, unknown>
  const copy = (s.copy && typeof s.copy === "object" ? s.copy : {}) as Record<string, unknown>
  const meta = (s.meta && typeof s.meta === "object" ? s.meta : {}) as Record<string, unknown>
  const phone = str(b.phone)
  const servicesIn = Array.isArray(copy.services) ? copy.services : []
  const faqIn = Array.isArray(copy.faq) ? copy.faq : []
  const reviewsIn = Array.isArray(s.reviews) ? s.reviews : []

  return {
    business: {
      name: str(b.name) || empty.business.name,
      category: str(b.category),
      phone,
      tel: str(b.tel) || telOf(phone),
      address: str(b.address),
      mapsUrl: str(b.mapsUrl),
      area: str(b.area),
      rating: numOrNull(b.rating),
      reviewCount: numOrNull(b.reviewCount ?? b.reviews),
    },
    copy: {
      heroHeadline: str(copy.heroHeadline) || empty.copy.heroHeadline,
      heroSub: str(copy.heroSub || copy.heroSubhead),
      about: str(copy.about),
      services: servicesIn
        .map((item) => {
          const it = item && typeof item === "object" ? (item as Record<string, unknown>) : {}
          return { title: str(it.title), desc: str(it.desc || it.body) }
        })
        .filter((x) => x.title),
      faq: faqIn
        .map((item) => {
          const it = item && typeof item === "object" ? (item as Record<string, unknown>) : {}
          return { q: str(it.q), a: str(it.a) }
        })
        .filter((x) => x.q),
    },
    reviews: reviewsIn
      .map((item) => {
        const it = item && typeof item === "object" ? (item as Record<string, unknown>) : {}
        return {
          author: str(it.author) || "Google user",
          rating: Number(it.rating) || 0,
          text: str(it.text),
          relativeTime: str(it.relativeTime || it.date),
        }
      })
      .filter((x) => x.text),
    meta: {
      preview: meta.preview !== false,
      generatedAt: meta.generatedAt == null ? null : str(meta.generatedAt),
      placeId: str(meta.placeId) || placeId,
      model: meta.model ? str(meta.model) : undefined,
    },
  }
}

export function telOf(phone: string): string {
  const cleaned = String(phone || "").replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "")
  return cleaned ? `tel:${cleaned}` : ""
}

export function initialOf(name: string): string {
  const ch = String(name || "").trim().charAt(0)
  return ch ? ch.toUpperCase() : "•"
}
