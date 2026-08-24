"use client"

import {
  ArrowRight,
  Calculator,
  Check,
  ChevronRight,
  Clock,
  FileText,
  Mail,
  MapPin,
  Phone,
  Shield,
  Star,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { PrefixLink } from "@/components/prefix-link"
import { initialOf, type AppPage, type SiteConfig } from "@/lib/site-config"

const ICONS = [Calculator, FileText, Shield, Users, Clock, Mail]

function Stars({ n }: { n: number }) {
  const full = Math.max(0, Math.min(5, Math.round(n || 0)))
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-5 h-5 ${i <= full ? "fill-amber-400 text-amber-400" : "text-emerald-200"}`}
        />
      ))}
    </div>
  )
}

function Nav({ site, current }: { site: SiteConfig; current: AppPage }) {
  const name = site.business.name
  const letter = initialOf(name)
  const linkCls = (page: AppPage) =>
    current === page ? "text-emerald-600 font-medium" : "hover:text-emerald-600 transition"

  return (
    <nav className="flex items-center justify-between px-8 py-4 border-b border-emerald-100">
      <PrefixLink page="home" className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center">
          <span className="text-white font-bold text-lg">{letter}</span>
        </div>
        <span className="font-semibold text-xl text-emerald-900">{name}</span>
      </PrefixLink>
      <div className="hidden md:flex items-center gap-8 text-emerald-800">
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
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">Get a Quote</Button>
      </PrefixLink>
    </nav>
  )
}

function Footer({ site }: { site: SiteConfig }) {
  const b = site.business
  const year = new Date().getFullYear()
  return (
    <footer className="bg-emerald-950 text-emerald-200 px-8 py-12">
      <div className="max-w-6xl mx-auto grid md:grid-cols-4 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center">
              <span className="text-white font-bold">{initialOf(b.name)}</span>
            </div>
            <span className="font-semibold text-white">{b.name}</span>
          </div>
          <p className="text-sm text-emerald-300/70">
            {b.category ? `${b.category}${b.area ? ` in ${b.area}` : ""}` : site.copy.heroSub}
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-white mb-4">Services</h4>
          <ul className="space-y-2 text-sm">
            {site.copy.services.slice(0, 4).map((s) => (
              <li key={s.title}>{s.title}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-white mb-4">Quick Links</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <PrefixLink page="about" className="hover:text-white transition">
                About Us
              </PrefixLink>
            </li>
            <li>
              <PrefixLink page="contact" className="hover:text-white transition">
                Contact
              </PrefixLink>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-white mb-4">Contact</h4>
          <ul className="space-y-2 text-sm">
            {b.address ? (
              <li className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {b.mapsUrl ? (
                  <a href={b.mapsUrl} className="hover:text-white" target="_blank" rel="noreferrer">
                    {b.address}
                  </a>
                ) : (
                  b.address
                )}
              </li>
            ) : null}
            {b.phone ? (
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <a href={b.tel || undefined} className="hover:text-white">
                  {b.phone}
                </a>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
      <div className="max-w-6xl mx-auto mt-8 pt-8 border-t border-emerald-800 text-center text-sm text-emerald-400">
        © {year} {b.name}. Preview / mockup — not the live website.
      </div>
    </footer>
  )
}

export function EmeraldHome({ site }: { site: SiteConfig }) {
  const b = site.business
  const c = site.copy
  return (
    <>
      <Nav site={site} current="home" />
      <section className="px-8 py-20 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            {(b.category || b.area) && (
              <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-sm mb-6">
                <Check className="w-4 h-4" />
                {b.category || "Local firm"}
                {b.area ? ` in ${b.area}` : ""}
              </div>
            )}
            <h1 className="text-5xl font-bold text-emerald-950 leading-tight mb-6">{c.heroHeadline}</h1>
            {c.heroSub ? <p className="text-lg text-emerald-800/70 mb-8 leading-relaxed">{c.heroSub}</p> : null}
            <div className="flex flex-wrap gap-4">
              <PrefixLink page="contact">
                <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                  Schedule Consultation <ChevronRight className="w-4 h-4" />
                </Button>
              </PrefixLink>
              {b.tel ? (
                <a href={b.tel}>
                  <Button size="lg" variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 gap-2">
                    <Phone className="w-4 h-4" /> {b.phone}
                  </Button>
                </a>
              ) : null}
            </div>
          </div>
          <div className="bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-3xl p-8">
            <div className="grid grid-cols-2 gap-4">
              {c.services.slice(0, 4).map((item, i) => {
                const Icon = ICONS[i % ICONS.length]
                return (
                  <div key={item.title} className="bg-white rounded-2xl p-6 shadow-sm">
                    <Icon className="w-8 h-8 text-emerald-600 mb-3" />
                    <p className="font-medium text-emerald-900">{item.title}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>
      {(b.rating || b.reviewCount || b.area) && (
        <section className="bg-emerald-600 text-white py-12 px-8">
          <div className="max-w-4xl mx-auto grid grid-cols-3 gap-8 text-center">
            {b.rating ? (
              <div>
                <div className="text-4xl font-bold">{b.rating.toFixed(1)}</div>
                <div className="text-emerald-100">Google rating</div>
              </div>
            ) : null}
            {b.reviewCount ? (
              <div>
                <div className="text-4xl font-bold">{b.reviewCount}</div>
                <div className="text-emerald-100">Reviews</div>
              </div>
            ) : null}
            {b.area ? (
              <div>
                <div className="text-4xl font-bold">{b.area}</div>
                <div className="text-emerald-100">Service area</div>
              </div>
            ) : null}
          </div>
        </section>
      )}
      {c.services.length > 0 && (
        <section className="px-8 py-20 max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-emerald-950 mb-4">Our Services</h2>
            <p className="text-emerald-700/70 max-w-2xl mx-auto">
              {b.category ? `${b.category} services${b.area ? ` for ${b.area}` : ""}` : "How we can help"}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {c.services.map((service, i) => {
              const Icon = ICONS[i % ICONS.length]
              return (
                <div key={service.title} className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-6">
                  <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-emerald-900 mb-2">{service.title}</h3>
                  <p className="text-emerald-700/70 text-sm leading-relaxed">{service.desc}</p>
                </div>
              )
            })}
          </div>
        </section>
      )}
      {c.about ? (
        <section className="bg-emerald-950 text-white px-8 py-20">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">About {b.name}</h2>
              <p className="text-emerald-200 mb-8 leading-relaxed">{c.about}</p>
              <PrefixLink page="about">
                <Button className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 gap-2">
                  Learn more <ArrowRight className="w-4 h-4" />
                </Button>
              </PrefixLink>
            </div>
            <div className="bg-emerald-900 rounded-3xl p-8 space-y-3 text-emerald-100">
              <h3 className="text-xl font-semibold mb-4">Get in touch</h3>
              {b.phone ? (
                <a href={b.tel} className="flex items-center gap-2 hover:text-white">
                  <Phone className="w-4 h-4" /> {b.phone}
                </a>
              ) : null}
              {b.address ? (
                <p className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> {b.address}
                </p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
      {site.reviews.length > 0 && (
        <section className="px-8 py-20 max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-emerald-950 mb-4">What clients say</h2>
            <p className="text-emerald-700/70">Reviews via Google</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {site.reviews.map((review) => (
              <div key={`${review.author}-${review.text.slice(0, 24)}`} className="bg-white border border-emerald-100 rounded-2xl p-6 shadow-sm">
                <div className="mb-4">
                  <Stars n={review.rating} />
                </div>
                <p className="text-emerald-800/80 mb-4 leading-relaxed">&ldquo;{review.text}&rdquo;</p>
                <p className="font-medium text-emerald-900">— {review.author}</p>
                {review.relativeTime ? <p className="text-sm text-emerald-600/70 mt-1">{review.relativeTime}</p> : null}
              </div>
            ))}
          </div>
        </section>
      )}
      <section className="px-8 py-16 bg-emerald-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-emerald-950 mb-4">Ready to get started?</h2>
          <p className="text-emerald-700/70 mb-8">
            {b.phone ? `Call ${b.phone} or send a note — we'll take it from there.` : "Get in touch and we'll take it from there."}
          </p>
          <PrefixLink page="contact">
            <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-8">
              Contact us <ArrowRight className="w-4 h-4" />
            </Button>
          </PrefixLink>
        </div>
      </section>
      <Footer site={site} />
    </>
  )
}

export function EmeraldAbout({ site }: { site: SiteConfig }) {
  const b = site.business
  const c = site.copy
  return (
    <>
      <Nav site={site} current="about" />
      <section className="px-8 py-16 max-w-5xl mx-auto text-center">
        <h1 className="text-5xl font-bold text-emerald-950 mb-6">About {b.name}</h1>
        {c.about ? <p className="text-xl text-emerald-800/70 max-w-2xl mx-auto leading-relaxed">{c.about}</p> : null}
      </section>
      {c.faq.length > 0 && (
        <section className="px-8 pb-16 max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-emerald-950 text-center mb-12">Questions</h2>
          <div className="space-y-4">
            {c.faq.map((item) => (
              <div key={item.q} className="bg-emerald-50 rounded-2xl p-6">
                <h3 className="font-semibold text-emerald-900 mb-2">{item.q}</h3>
                <p className="text-emerald-700/80">{item.a}</p>
              </div>
            ))}
          </div>
        </section>
      )}
      <section className="bg-emerald-600 text-white py-16 px-8 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to work together?</h2>
        <p className="text-emerald-100 mb-8 max-w-xl mx-auto">
          {b.phone ? `Call ${b.phone} or send a message.` : "Send a message and we'll get back to you."}
        </p>
        <PrefixLink page="contact">
          <Button size="lg" className="bg-white text-emerald-700 hover:bg-emerald-50 gap-2">
            Contact Us <ChevronRight className="w-4 h-4" />
          </Button>
        </PrefixLink>
      </section>
      <Footer site={site} />
    </>
  )
}

export function EmeraldContact({ site }: { site: SiteConfig }) {
  const b = site.business
  return (
    <>
      <Nav site={site} current="contact" />
      <section className="px-8 py-16 max-w-5xl mx-auto text-center">
        <h1 className="text-5xl font-bold text-emerald-950 mb-6">Get in Touch</h1>
        <p className="text-xl text-emerald-800/70 max-w-xl mx-auto">
          {b.area ? `Serving ${b.area}.` : "We'd like to hear from you."}
        </p>
      </section>
      <section className="px-8 pb-20 max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="text-2xl font-bold text-emerald-950 mb-6">Contact Information</h2>
            <div className="space-y-6">
              {b.phone ? (
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Phone className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-medium text-emerald-900">Phone</p>
                    <a href={b.tel} className="text-emerald-700/70 hover:text-emerald-900">
                      {b.phone}
                    </a>
                  </div>
                </div>
              ) : null}
              {b.address ? (
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-medium text-emerald-900">Location</p>
                    {b.mapsUrl ? (
                      <a href={b.mapsUrl} className="text-emerald-700/70 hover:text-emerald-900" target="_blank" rel="noreferrer">
                        {b.address}
                      </a>
                    ) : (
                      <p className="text-emerald-700/70">{b.address}</p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <div className="bg-emerald-50 rounded-3xl p-8">
            <h2 className="text-2xl font-bold text-emerald-950 mb-6">Send a message</h2>
            <p className="text-emerald-800/70 mb-4">
              This preview does not submit a form
              {b.phone ? ` — call ${b.phone} instead.` : "."}
            </p>
            {b.tel ? (
              <a href={b.tel}>
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                  Call {b.phone} <Phone className="w-4 h-4" />
                </Button>
              </a>
            ) : null}
          </div>
        </div>
      </section>
      <Footer site={site} />
    </>
  )
}
