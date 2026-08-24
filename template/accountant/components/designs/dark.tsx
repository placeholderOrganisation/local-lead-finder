"use client"

import {
  ArrowRight,
  Calculator,
  Check,
  Clock,
  FileText,
  MapPin,
  Phone,
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
        <Star key={i} className={`w-4 h-4 ${i <= full ? "fill-teal-400 text-teal-400" : "text-slate-700"}`} />
      ))}
    </div>
  )
}

function Nav({ site, current }: { site: SiteConfig; current: AppPage }) {
  const linkCls = (page: AppPage) =>
    current === page ? "text-teal-400 font-medium" : "hover:text-white transition"

  return (
    <nav className="flex items-center justify-between px-8 py-5 border-b border-slate-800">
      <PrefixLink page="home" className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-emerald-500 rounded-lg flex items-center justify-center text-slate-950 font-bold">
          {initialOf(site.business.name)}
        </div>
        <span className="font-semibold text-xl text-white tracking-tight">{site.business.name}</span>
        {site.business.category ? <span className="text-slate-500 text-sm hidden sm:inline">{site.business.category}</span> : null}
      </PrefixLink>
      <div className="hidden md:flex items-center gap-8 text-slate-400">
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
        <Button className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-medium">Contact Us</Button>
      </PrefixLink>
    </nav>
  )
}

function Footer({ site }: { site: SiteConfig }) {
  const b = site.business
  return (
    <footer className="border-t border-slate-800 px-8 py-12">
      <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8 text-slate-400 text-sm">
        <div>
          <p className="text-white font-semibold mb-2">{b.name}</p>
          <p>{b.category}{b.area ? ` · ${b.area}` : ""}</p>
        </div>
        <div className="space-y-2">
          <PrefixLink page="about" className="hover:text-white block">
            About
          </PrefixLink>
          <PrefixLink page="contact" className="hover:text-white block">
            Contact
          </PrefixLink>
        </div>
        <div className="space-y-2">
          {b.phone ? (
            <a href={b.tel} className="flex items-center gap-2 hover:text-white">
              <Phone className="w-4 h-4 text-teal-500" /> {b.phone}
            </a>
          ) : null}
          {b.address ? (
            <p className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-teal-500" /> {b.address}
            </p>
          ) : null}
        </div>
      </div>
    </footer>
  )
}

export function DarkHome({ site }: { site: SiteConfig }) {
  const b = site.business
  const c = site.copy
  return (
    <div className="min-h-screen bg-slate-950">
      <Nav site={site} current="home" />
      <section className="px-8 py-24 max-w-6xl mx-auto text-center">
        {(b.rating || b.reviewCount) && (
          <div className="inline-flex items-center gap-2 border border-slate-700 text-slate-300 px-4 py-2 rounded-full text-sm mb-8">
            <Star className="w-4 h-4 text-teal-400" />
            {b.rating ? `${b.rating.toFixed(1)} Google rating` : "Google reviews"}
            {b.reviewCount ? ` · ${b.reviewCount} reviews` : ""}
          </div>
        )}
        <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-6 max-w-4xl mx-auto text-balance">
          {c.heroHeadline}
        </h1>
        {c.heroSub ? <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">{c.heroSub}</p> : null}
        <div className="flex justify-center flex-wrap gap-4 mb-16">
          <PrefixLink page="contact">
            <Button size="lg" className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-medium gap-2 px-8">
              Get Started <ArrowRight className="w-4 h-4" />
            </Button>
          </PrefixLink>
          {b.tel ? (
            <a href={b.tel}>
              <Button size="lg" variant="outline" className="border-slate-700 text-white hover:bg-slate-800">
                {b.phone}
              </Button>
            </a>
          ) : null}
        </div>
      </section>
      {c.services.length > 0 && (
        <section className="px-8 py-20 border-t border-slate-800">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white mb-4">Services</h2>
              <p className="text-slate-400 max-w-2xl mx-auto">{b.category || "What we do"}</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {c.services.map((service, i) => {
                const Icon = ICONS[i % ICONS.length]
                return (
                  <div key={service.title} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-teal-500/50 transition">
                    <div className="w-12 h-12 bg-teal-500/10 rounded-xl flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6 text-teal-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{service.title}</h3>
                    <p className="text-slate-400 text-sm">{service.desc}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}
      {c.about ? (
        <section className="px-8 py-20 bg-slate-900/50">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-6">Why {b.name}</h2>
            <p className="text-slate-400 mb-8 leading-relaxed">{c.about}</p>
            <PrefixLink page="about">
              <Button className="bg-teal-500 hover:bg-teal-400 text-slate-950 gap-2">
                About us <ArrowRight className="w-4 h-4" />
              </Button>
            </PrefixLink>
          </div>
        </section>
      ) : null}
      {site.reviews.length > 0 && (
        <section className="px-8 py-20">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white mb-4">Client stories</h2>
              <p className="text-slate-400">Reviews via Google</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {site.reviews.map((review) => (
                <div key={`${review.author}-${review.text.slice(0, 24)}`} className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <div className="mb-4">
                    <Stars n={review.rating} />
                  </div>
                  <p className="text-slate-300 mb-6 leading-relaxed">&ldquo;{review.text}&rdquo;</p>
                  <p className="font-medium text-white">{review.author}</p>
                  {review.relativeTime ? <p className="text-sm text-slate-500">{review.relativeTime}</p> : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
      <section className="px-8 py-16">
        <div className="max-w-4xl mx-auto bg-gradient-to-r from-teal-500/20 to-emerald-500/20 border border-teal-500/30 rounded-3xl p-12 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to talk?</h2>
          <p className="text-slate-300 mb-8 max-w-xl mx-auto">
            {b.phone ? `Call ${b.phone} or send a note.` : "Get in touch and we'll take it from there."}
          </p>
          <PrefixLink page="contact">
            <Button size="lg" className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-medium gap-2 px-8">
              Book a conversation <ArrowRight className="w-4 h-4" />
            </Button>
          </PrefixLink>
        </div>
      </section>
      <Footer site={site} />
    </div>
  )
}

export function DarkAbout({ site }: { site: SiteConfig }) {
  const b = site.business
  const c = site.copy
  return (
    <div className="min-h-screen bg-slate-950">
      <Nav site={site} current="about" />
      <section className="px-8 py-20 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-white mb-6">
            The story behind{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-400">{b.name}</span>
          </h1>
          {c.about ? <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">{c.about}</p> : null}
        </div>
        {c.faq.length > 0 && (
          <div className="grid md:grid-cols-2 gap-6">
            {c.faq.map((item) => (
              <div key={item.q} className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-xl font-semibold text-white mb-2">{item.q}</h3>
                <p className="text-slate-400">{item.a}</p>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="px-8 py-16 text-center border-t border-slate-800">
        <h2 className="text-3xl font-bold text-white mb-4">Let&apos;s work together</h2>
        <PrefixLink page="contact">
          <Button size="lg" className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-medium gap-2">
            Get in Touch <ArrowRight className="w-4 h-4" />
          </Button>
        </PrefixLink>
      </section>
      <Footer site={site} />
    </div>
  )
}

export function DarkContact({ site }: { site: SiteConfig }) {
  const b = site.business
  return (
    <div className="min-h-screen bg-slate-950">
      <Nav site={site} current="contact" />
      <section className="px-8 py-20 max-w-5xl mx-auto text-center">
        <h1 className="text-5xl font-bold text-white mb-6">
          Let&apos;s{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-400">connect</span>
        </h1>
        <p className="text-xl text-slate-400 max-w-xl mx-auto">{b.area ? `Serving ${b.area}.` : "We'd like to hear from you."}</p>
      </section>
      <section className="px-8 pb-20 max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {b.phone ? (
            <a href={b.tel} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-teal-500/50 transition">
              <Phone className="w-6 h-6 text-teal-400 mb-4" />
              <p className="text-sm text-slate-500 mb-1">Call</p>
              <p className="text-white font-medium">{b.phone}</p>
            </a>
          ) : null}
          {b.address ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <MapPin className="w-6 h-6 text-teal-400 mb-4" />
              <p className="text-sm text-slate-500 mb-1">Visit</p>
              <p className="text-white font-medium">{b.address}</p>
            </div>
          ) : null}
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-slate-400">
          This preview does not submit a form
          {b.phone ? ` — call ${b.phone} instead.` : "."}
        </div>
      </section>
      <Footer site={site} />
    </div>
  )
}
