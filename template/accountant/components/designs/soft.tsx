"use client"

import {
  ArrowRight,
  Calculator,
  Check,
  ChevronRight,
  Clock,
  FileText,
  MapPin,
  Phone,
  Send,
  Shield,
  Star,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { PrefixLink } from "@/components/prefix-link"
import { initialOf, type AppPage, type SiteConfig } from "@/lib/site-config"

const ICONS = [Calculator, FileText, Shield, Users, Clock, Star]

function Stars({ n }: { n: number }) {
  const full = Math.max(0, Math.min(5, Math.round(n || 0)))
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`w-5 h-5 ${i <= full ? "fill-amber-400 text-amber-400" : "text-stone-200"}`} />
      ))}
    </div>
  )
}

function Leaf({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="currentColor" aria-hidden>
      <path d="M16 4C16 4 8 8 8 16C8 24 16 28 16 28C16 28 24 24 24 16C24 8 16 4 16 4Z" opacity="0.3" />
      <path d="M16 6C16 6 10 9 10 16C10 23 16 26 16 26C16 26 22 23 22 16C22 9 16 6 16 6Z" />
    </svg>
  )
}

function Nav({ site, current }: { site: SiteConfig; current: AppPage }) {
  const linkCls = (page: AppPage) =>
    current === page ? "text-green-700 font-medium" : "hover:text-green-700 transition"

  return (
    <nav className="flex items-center justify-between px-8 py-4 max-w-6xl mx-auto">
      <PrefixLink page="home" className="flex items-center gap-2">
        <Leaf className="w-8 h-8 text-green-700" />
        <span className="font-semibold text-xl text-stone-800">{site.business.name}</span>
      </PrefixLink>
      <div className="hidden md:flex items-center gap-8 text-stone-600">
        <PrefixLink page="home" className={linkCls("home")}>
          Home
        </PrefixLink>
        <PrefixLink page="about" className={linkCls("about")}>
          About
        </PrefixLink>
        <PrefixLink page="contact" className={linkCls("contact")}>
          Contact
        </PrefixLink>
      </div>
      <PrefixLink page="contact">
        <Button className="bg-green-700 hover:bg-green-800 text-white rounded-full px-6">Book a Call</Button>
      </PrefixLink>
    </nav>
  )
}

function Footer({ site }: { site: SiteConfig }) {
  const b = site.business
  return (
    <footer className="bg-stone-900 text-stone-300 px-8 py-12">
      <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8 text-sm">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Leaf className="w-8 h-8 text-green-500" />
            <span className="font-semibold text-white">{b.name}</span>
          </div>
          <p className="text-stone-400">{b.category}{b.area ? ` in ${b.area}` : ""}</p>
        </div>
        <div className="space-y-2">
          <PrefixLink page="about" className="hover:text-white block">
            About Us
          </PrefixLink>
          <PrefixLink page="contact" className="hover:text-white block">
            Contact
          </PrefixLink>
        </div>
        <div className="space-y-2">
          {b.address ? (
            <p className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-500" /> {b.address}
            </p>
          ) : null}
          {b.phone ? (
            <a href={b.tel} className="flex items-center gap-2 hover:text-white">
              <Phone className="w-4 h-4 text-green-500" /> {b.phone}
            </a>
          ) : null}
        </div>
      </div>
    </footer>
  )
}

export function SoftHome({ site }: { site: SiteConfig }) {
  const b = site.business
  const c = site.copy
  const featured = site.reviews[0]
  return (
    <div className="min-h-screen bg-stone-50">
      <Nav site={site} current="home" />
      <section className="px-8 pt-16 pb-20 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            {b.area ? <p className="text-green-700 font-medium mb-4">{b.area}&apos;s {b.category || "local firm"}</p> : null}
            <h1 className="text-5xl font-bold text-stone-900 leading-tight mb-6 text-balance">{c.heroHeadline}</h1>
            {c.heroSub ? <p className="text-lg text-stone-600 mb-8 leading-relaxed">{c.heroSub}</p> : null}
            <div className="flex flex-wrap gap-4 mb-8">
              <PrefixLink page="contact">
                <Button size="lg" className="bg-green-700 hover:bg-green-800 text-white rounded-full gap-2 px-8">
                  Get in touch <ChevronRight className="w-4 h-4" />
                </Button>
              </PrefixLink>
            </div>
            <div className="flex items-center gap-6 text-sm text-stone-500">
              {b.phone ? (
                <a href={b.tel} className="flex items-center gap-2 hover:text-stone-800">
                  <Phone className="w-4 h-4" /> {b.phone}
                </a>
              ) : null}
              {b.address ? (
                <span className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> {b.address}
                </span>
              ) : null}
            </div>
          </div>
          {featured ? (
            <div className="bg-white rounded-3xl p-8 shadow-xl shadow-stone-200/50">
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <Users className="w-10 h-10 text-green-700" />
                </div>
                <h3 className="font-semibold text-stone-900">What clients say</h3>
              </div>
              <blockquote className="text-stone-600 italic text-center mb-4">&ldquo;{featured.text}&rdquo;</blockquote>
              <div className="flex justify-center">
                <Stars n={featured.rating} />
              </div>
              <p className="text-center text-sm text-stone-500 mt-2">— {featured.author}</p>
            </div>
          ) : null}
        </div>
      </section>
      {c.services.length > 0 && (
        <section className="bg-white px-8 py-20">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-stone-900 mb-4">How we can help</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {c.services.map((service, i) => {
                const Icon = ICONS[i % ICONS.length]
                return (
                  <div key={service.title}>
                    <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mb-4">
                      <Icon className="w-7 h-7 text-green-700" />
                    </div>
                    <h3 className="text-lg font-semibold text-stone-900 mb-2">{service.title}</h3>
                    <p className="text-stone-600 leading-relaxed">{service.desc}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}
      {c.about ? (
        <section className="px-8 py-20 max-w-6xl mx-auto">
          <div className="bg-green-700 rounded-3xl p-10 text-white">
            <h3 className="text-2xl font-bold mb-4">About {b.name}</h3>
            <p className="text-green-100 mb-6 leading-relaxed">{c.about}</p>
            <PrefixLink page="about">
              <Button variant="outline" className="border-white text-white hover:bg-white hover:text-green-700 rounded-full">
                Learn more
              </Button>
            </PrefixLink>
          </div>
        </section>
      ) : null}
      {site.reviews.length > 1 && (
        <section className="px-8 py-20 max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-stone-900 text-center mb-4">Happy clients</h2>
          <p className="text-stone-600 text-center mb-12">Reviews via Google</p>
          <div className="grid md:grid-cols-3 gap-6">
            {site.reviews.map((review) => (
              <div key={`${review.author}-${review.text.slice(0, 24)}`} className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="mb-4">
                  <Stars n={review.rating} />
                </div>
                <p className="text-stone-600 mb-6 leading-relaxed">&ldquo;{review.text}&rdquo;</p>
                <p className="font-medium text-stone-900">{review.author}</p>
              </div>
            ))}
          </div>
        </section>
      )}
      <section className="px-8 py-16 bg-green-700">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to simplify the books?</h2>
          <p className="text-green-100 mb-8 max-w-xl mx-auto">
            {b.phone ? `Call ${b.phone} — we'll take it from there.` : "Get in touch and we'll take it from there."}
          </p>
          <PrefixLink page="contact">
            <Button size="lg" className="bg-white text-green-700 hover:bg-green-50 rounded-full gap-2 px-8">
              Book a conversation <ArrowRight className="w-4 h-4" />
            </Button>
          </PrefixLink>
        </div>
      </section>
      <Footer site={site} />
    </div>
  )
}

export function SoftAbout({ site }: { site: SiteConfig }) {
  const b = site.business
  const c = site.copy
  return (
    <div className="min-h-screen bg-stone-50">
      <Nav site={site} current="about" />
      <section className="px-8 pt-16 pb-12 max-w-4xl mx-auto text-center">
        <p className="text-green-700 font-medium mb-4">About us</p>
        <h1 className="text-5xl font-bold text-stone-900 mb-6">More than the books — a partner</h1>
        {c.about ? <p className="text-lg text-stone-600 max-w-2xl mx-auto">{c.about}</p> : null}
      </section>
      {c.faq.length > 0 && (
        <section className="px-8 py-16 bg-white">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-stone-900 text-center mb-12">Questions</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {c.faq.map((item) => (
                <div key={item.q} className="p-6">
                  <h3 className="font-semibold text-stone-900 mb-2">{item.q}</h3>
                  <p className="text-sm text-stone-600">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
      <section className="px-8 py-16 max-w-4xl mx-auto text-center">
        <div className="bg-green-700 rounded-3xl p-12 text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to chat?</h2>
          <PrefixLink page="contact">
            <Button size="lg" className="bg-white text-green-700 hover:bg-green-50 rounded-full gap-2 px-8">
              Get in Touch <ChevronRight className="w-4 h-4" />
            </Button>
          </PrefixLink>
        </div>
      </section>
    </div>
  )
}

export function SoftContact({ site }: { site: SiteConfig }) {
  const b = site.business
  return (
    <div className="min-h-screen bg-stone-50">
      <Nav site={site} current="contact" />
      <section className="px-8 pt-16 pb-8 max-w-4xl mx-auto text-center">
        <p className="text-green-700 font-medium mb-4">Contact</p>
        <h1 className="text-5xl font-bold text-stone-900 mb-6">We&apos;d love to hear from you</h1>
        <p className="text-lg text-stone-600 max-w-xl mx-auto">{b.area ? `Serving ${b.area}.` : "Tell us what you need."}</p>
      </section>
      <section className="px-8 py-8 max-w-4xl mx-auto">
        <div className="grid md:grid-cols-2 gap-4 mb-12">
          {b.phone ? (
            <a href={b.tel} className="bg-white rounded-2xl p-6 text-center shadow-sm hover:shadow-md transition">
              <Phone className="w-6 h-6 text-green-700 mx-auto mb-4" />
              <p className="font-medium text-stone-900 mb-1">Call</p>
              <p className="text-stone-600 text-sm">{b.phone}</p>
            </a>
          ) : null}
          {b.address ? (
            <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
              <MapPin className="w-6 h-6 text-green-700 mx-auto mb-4" />
              <p className="font-medium text-stone-900 mb-1">Visit</p>
              <p className="text-stone-600 text-sm">{b.address}</p>
            </div>
          ) : null}
        </div>
      </section>
      <section className="px-8 pb-20 max-w-4xl mx-auto">
        <div className="bg-white rounded-3xl shadow-xl shadow-stone-200/50 p-8 md:p-12 text-stone-600">
          This preview does not submit a form
          {b.phone ? ` — call ${b.phone} instead.` : "."}
          {b.tel ? (
            <a href={b.tel} className="block mt-6">
              <Button className="w-full bg-green-700 hover:bg-green-800 text-white rounded-full gap-2">
                Call {b.phone} <Send className="w-4 h-4" />
              </Button>
            </a>
          ) : null}
        </div>
      </section>
      <Footer site={site} />
    </div>
  )
}
