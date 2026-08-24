/* ============================================================
   app.js — binds window.SITE to both pages, runs the design
   switcher and mobile nav. Vanilla, no modules, file:// safe.
   Never uses innerHTML for config strings (textContent only).
   ============================================================ */
(function () {
  "use strict";

  var SITE = normalizeSite(window.SITE || {});
  var doc = document;
  var LS_KEY = "mockup.design";

  /* ---------- tiny helpers ---------- */
  function $(id) { return doc.getElementById(id); }
  function el(tag, cls) { var n = doc.createElement(tag); if (cls) n.className = cls; return n; }
  function txt(node, value) { if (node) node.textContent = value == null ? "" : String(value); }
  function has(v) { return v != null && String(v).trim() !== ""; }
  function arr(v) { return (v && v.length) ? v : []; }
  function hide(node) { if (node) node.hidden = true; }
  function show(node) { if (node) node.hidden = false; }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
  function telHref(phone) {
    if (!has(phone)) return "";
    var cleaned = String(phone).replace(/[^\d+]/g, "");
    // keep only a single leading +
    cleaned = cleaned.replace(/(?!^)\+/g, "");
    return "tel:" + cleaned;
  }

  /* ---------- #40 window.SITE contract → template render shape ---------- */
  function isContract(s) {
    return s && typeof s.business === "object" && s.business !== null && !Array.isArray(s.business);
  }
  function normalizeSite(raw) {
    var s = raw || {};
    if (!isContract(s)) return s;
    var b = s.business;
    var copy = s.copy || {};
    var meta = s.meta || {};
    var reviewsIn = Array.isArray(s.reviews) ? s.reviews : [];
    var name = b.name || "";
    var phone = b.phone || "";
    var services = (copy.services || []).map(function (item) {
      return { title: item.title, body: item.desc || item.body || "", icon: item.icon || "spark" };
    });
    return {
      business: name,
      tagline: copy.heroSub || "",
      category: b.category || "",
      phone: phone,
      email: b.email || s.email || "",
      address: b.address || "",
      mapsUrl: b.mapsUrl || "",
      area: b.area || "",
      lang: s.lang || "en",
      previewLabel: "Preview / mockup",
      placeId: meta.placeId || "",
      logoText: name,
      logoSvg: "",
      colors: s.colors || {},
      nav: s.nav || [
        { label: "About", href: "about.html" },
        { label: "Services", href: "index.html#services" },
        { label: "Reviews", href: "index.html#reviews" },
        { label: "Contact", href: "index.html#contact" }
      ],
      ctaPrimary: s.ctaPrimary || { label: "Call now", href: "tel:" },
      ctaSecondary: s.ctaSecondary || { label: "Get in touch", href: "index.html#contact" },
      hero: {
        kicker: copy.heroKicker || b.category || "",
        headline: copy.heroHeadline || name,
        subhead: copy.heroSub || "",
        imageCaption: copy.heroCaption || ""
      },
      about: {
        heading: copy.aboutHeading || (name ? "About " + name : "About us"),
        kicker: "",
        teaser: copy.about || "",
        body: copy.about || "",
        bullets: copy.aboutBullets || [],
        values: [],
        owner: {}
      },
      services: { heading: "Services", kicker: "", intro: "", items: services },
      faq: { heading: "Questions", items: copy.faq || [] },
      reviews: {
        heading: "What clients say",
        sourceLabel: "Reviews via Google",
        rating: b.rating,
        count: b.reviewCount,
        mapsUrl: b.mapsUrl,
        items: reviewsIn.map(function (r) {
          return {
            author: r.author,
            rating: r.rating,
            text: r.text,
            date: r.relativeTime || r.date || "",
            authorUrl: "",
            photoUrl: ""
          };
        })
      },
      contact: { heading: "Contact us", body: "", formEnabled: false },
      footer: { blurb: copy.heroSub || "", legal: "Preview / mockup — not the live website." },
      hours: [],
      credentials: [],
      stats: [],
      audiences: { items: [] },
      process: { steps: [] },
      pricing: { tiers: [] },
      notice: {},
      defaultDesign: s.defaultDesign || 1,
      showDesignSwitcher: s.showDesignSwitcher !== false
    };
  }

  /* ---------- inline SVG icon set ---------- */
  var ICONS = {
    phone: 'M6.6 2.5 4 3.2c-.5.1-.8.6-.7 1.1.7 4.4 3 8.7 6.4 12.1s7.7 5.7 12.1 6.4c.5.1 1-.2 1.1-.7l.7-2.6c.1-.5-.2-1-.6-1.2l-3.5-1.5c-.4-.2-.9-.1-1.2.2l-1.3 1.3a14 14 0 0 1-5-5l1.3-1.3c.3-.3.4-.8.2-1.2L7.8 3.1c-.2-.4-.7-.7-1.2-.6Z',
    pin: 'M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z',
    clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 10.4-4.3 2.5-1-1.7L11 11V6h2Z',
    chart: 'M4 20V4H2v18h20v-2H4Zm3-3h2V9H7v8Zm4 0h2V6h-2v11Zm4 0h2v-6h-2v6Z',
    shield: 'M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5l-8-3Zm-1 13-3-3 1.4-1.4L11 12.2l4.6-4.6L17 9l-6 6Z',
    spark: 'M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4L12 2Z',
    quote: 'M7 7H4v6h3l-2 4h3l2-4V7Zm10 0h-3v6h3l-2 4h3l2-4V7Z',
    star: 'M12 2l2.9 6.3L22 9.2l-5 4.6 1.3 6.9L12 17.3 5.7 20.7 7 13.8l-5-4.6 7.1-.9L12 2Z',
    check: 'M9.5 16.2 4.8 11.5l1.4-1.4 3.3 3.3 8.3-8.3 1.4 1.4z',
    user: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.4 0-8 2.6-8 6v2h16v-2c0-3.4-3.6-6-8-6Z',
    generic: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm0 12a5 5 0 0 1-4-2c0-1.3 2.7-2 4-2s4 .7 4 2a5 5 0 0 1-4 2Z'
  };
  function svgIcon(key, cls) {
    var d = ICONS[key] || ICONS.generic;
    var ns = "http://www.w3.org/2000/svg";
    var svg = doc.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", cls || "icon");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    var path = doc.createElementNS(ns, "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "currentColor");
    svg.appendChild(path);
    return svg;
  }
  function stars(rating, cls) {
    var wrap = el("span", "stars " + (cls || ""));
    wrap.setAttribute("role", "img");
    wrap.setAttribute("aria-label", (Math.round(rating * 10) / 10) + " out of 5 stars");
    var full = Math.round(rating || 0);
    for (var i = 1; i <= 5; i++) {
      var s = svgIcon("star", "stars__star" + (i <= full ? "" : " stars__star--off"));
      wrap.appendChild(s);
    }
    return wrap;
  }
  function initialsFrom(name, given) {
    if (has(given)) return String(given).trim();
    var parts = String(name || "").trim().split(/\s+/);
    var out = "";
    for (var i = 0; i < parts.length && out.length < 2; i++) {
      if (parts[i]) out += parts[i].charAt(0).toUpperCase();
    }
    return out || "•";
  }

  /* ---------- CSS variables from brand colors ---------- */
  function applyColors() {
    var c = SITE.colors || {};
    var root = doc.documentElement.style;
    var map = { accent: "--accent", accentInk: "--accent-ink", ink: "--ink", muted: "--muted", bg: "--bg", card: "--card" };
    for (var k in map) { if (has(c[k])) root.setProperty(map[k], c[k]); }
  }

  /* ---------- logo (sanitized SVG or wordmark) ---------- */
  function sanitizeSvg(markup) {
    // Allow a small set of shape tags + presentation attrs. Strip everything else.
    var wrap = el("div");
    wrap.innerHTML = markup; // parsed but detached; sanitized below before insertion
    var allowedTags = { SVG: 1, PATH: 1, G: 1, CIRCLE: 1, RECT: 1, LINE: 1, POLYGON: 1, POLYLINE: 1, ELLIPSE: 1 };
    var allowedAttr = { d: 1, fill: 1, stroke: 1, "stroke-width": 1, "stroke-linecap": 1, "stroke-linejoin": 1,
      cx: 1, cy: 1, r: 1, rx: 1, ry: 1, x: 1, y: 1, x1: 1, y1: 1, x2: 1, y2: 1, width: 1, height: 1,
      points: 1, viewbox: 1, transform: 1, opacity: 1, "fill-rule": 1, "clip-rule": 1, class: 1 };
    function walk(node) {
      var kids = [], i;
      for (i = 0; i < node.childNodes.length; i++) kids.push(node.childNodes[i]);
      for (i = 0; i < kids.length; i++) {
        var ch = kids[i];
        if (ch.nodeType === 1) {
          if (!allowedTags[ch.tagName.toUpperCase()]) { node.removeChild(ch); continue; }
          var attrs = [], j;
          for (j = 0; j < ch.attributes.length; j++) attrs.push(ch.attributes[j].name);
          for (j = 0; j < attrs.length; j++) {
            if (!allowedAttr[attrs[j].toLowerCase()]) ch.removeAttribute(attrs[j]);
          }
          walk(ch);
        } else if (ch.nodeType !== 3) {
          node.removeChild(ch);
        }
      }
    }
    walk(wrap);
    var svg = wrap.querySelector("svg");
    return svg;
  }
  function paintLogo() {
    var link = $("logo");
    if (link) {
      clear(link);
      if (has(SITE.logoSvg)) {
        var safe = sanitizeSvg(SITE.logoSvg);
        if (safe) { safe.setAttribute("class", "brand__svg"); link.appendChild(safe); }
        else txt(link, SITE.logoText || SITE.business || "");
      } else {
        txt(link, SITE.logoText || SITE.business || "");
      }
    }
    txt($("footer-logo"), SITE.logoText || SITE.business || "");
  }

  /* ---------- shared chrome ---------- */
  function paintSwitcher() {
    var sw = $("design-switcher");
    if (!sw) return;
    if (SITE.showDesignSwitcher === false) { hide(sw); return; }
    show(sw);
    txt($("switcher-label"), SITE.previewLabel || "Site preview");
    var btns = sw.querySelectorAll("[data-design-btn]");
    for (var i = 0; i < btns.length; i++) {
      (function (b) {
        b.addEventListener("click", function () { setDesign(b.getAttribute("data-design-btn")); });
      })(btns[i]);
    }
  }
  function setDesign(d) {
    d = String(d || "1");
    doc.documentElement.setAttribute("data-design", d);
    try { localStorage.setItem(LS_KEY, d); } catch (e) {}
    var btns = doc.querySelectorAll("[data-design-btn]");
    for (var i = 0; i < btns.length; i++) {
      var active = btns[i].getAttribute("data-design-btn") === d;
      btns[i].setAttribute("aria-pressed", active ? "true" : "false");
    }
  }
  function initDesign() {
    var stored = null;
    try { stored = localStorage.getItem(LS_KEY); } catch (e) {}
    setDesign(stored || SITE.defaultDesign || 1);
  }

  function paintNav() {
    var list = $("nav-list");
    if (list) {
      clear(list);
      var page = doc.documentElement.getAttribute("data-page");
      arr(SITE.nav).forEach(function (item) {
        var li = el("li", "primary-nav__item");
        var a = el("a", "primary-nav__link");
        a.href = item.href || "#";
        txt(a, item.label);
        var isAbout = /about\.html/.test(item.href || "");
        if ((page === "about" && isAbout)) { a.setAttribute("aria-current", "page"); }
        li.appendChild(a);
        list.appendChild(li);
      });
    }
    var cta = $("header-cta");
    if (cta && SITE.ctaSecondary) {
      txt(cta, SITE.ctaSecondary.label || "Get in touch");
      cta.href = SITE.ctaSecondary.href || "index.html#contact";
    }
  }

  function paintCallbar() {
    var bar = $("callbar");
    if (!bar) return;
    if (!has(SITE.phone)) { hide(bar); return; }
    show(bar);
    bar.href = telHref(SITE.phone);
    bar.appendChild(svgIcon("phone", "icon"));
    var label = $("callbar-label");
    txt(label, (SITE.ctaPrimary && SITE.ctaPrimary.label) || "Call now");
    // ensure icon precedes label
    bar.insertBefore($("callbar").querySelector("svg"), label);
  }

  function paintFooter() {
    var f = SITE.footer || {};
    txt($("footer-blurb"), f.blurb || "");
    // services list
    var fs = $("footer-services");
    if (fs) {
      clear(fs);
      arr(SITE.services && SITE.services.items).forEach(function (s) {
        var li = el("li");
        var a = el("a", "site-footer__link");
        a.href = "index.html#services";
        txt(a, s.title);
        li.appendChild(a); fs.appendChild(li);
      });
    }
    // contact list
    var fc = $("footer-contact");
    if (fc) {
      clear(fc);
      if (has(SITE.phone)) fc.appendChild(footerContactItem(telHref(SITE.phone), SITE.phone));
      if (has(SITE.email)) fc.appendChild(footerContactItem("mailto:" + SITE.email, SITE.email));
      if (has(SITE.address)) {
        var li = el("li"); txt(li, SITE.address); li.className = "site-footer__addr"; fc.appendChild(li);
      }
    }
    // credentials row
    var creds = arr(SITE.credentials);
    var fcr = $("footer-creds");
    if (fcr && creds.length) {
      clear(fcr); show(fcr);
      creds.forEach(function (c) { var li = el("li", "badge"); txt(li, c); fcr.appendChild(li); });
    }
    var year = new Date().getFullYear();
    txt($("footer-copy"), "© " + year + " " + (SITE.business || ""));
    txt($("footer-legal"), f.legal || "");
  }
  function footerContactItem(href, label) {
    var li = el("li");
    var a = el("a", "site-footer__link");
    a.href = href; txt(a, label);
    li.appendChild(a); return li;
  }

  function initMobileNav() {
    var toggle = $("nav-toggle");
    var nav = $("primary-nav");
    var header = $("site-header");
    if (!toggle || !nav) return;
    function close() {
      header.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
    }
    function open() {
      header.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Close menu");
    }
    toggle.addEventListener("click", function () {
      if (header.classList.contains("is-open")) close(); else open();
    });
    nav.addEventListener("click", function (e) {
      if (e.target && e.target.tagName === "A") close();
    });
    doc.addEventListener("keydown", function (e) {
      if (e.key === "Escape" || e.keyCode === 27) close();
    });
  }

  /* ---------- HOME page ---------- */
  function paintHero() {
    var h = SITE.hero || {};
    if (has(h.kicker)) { txt($("hero-kicker"), h.kicker); show($("hero-kicker")); }
    txt($("hero-headline"), h.headline || SITE.business || "");
    txt($("hero-subhead"), h.subhead || SITE.tagline || "");
    // CTAs
    var p = SITE.ctaPrimary || {}, s = SITE.ctaSecondary || {};
    var cp = $("hero-cta-primary");
    txt(cp, p.label || "Call now");
    cp.href = (p.href === "tel:" || !has(p.href)) ? telHref(SITE.phone) : p.href;
    if (!has(SITE.phone) && (!has(p.href) || p.href === "tel:")) hide(cp);
    var cs = $("hero-cta-secondary");
    txt(cs, s.label || "Contact");
    cs.href = s.href || "index.html#contact";
    // trust panel
    txt($("hero-mark"), initialsFrom(SITE.business, ""));
    var tp = $("hero-trust");
    clear(tp);
    if (has(SITE.yearEstablished)) tp.appendChild(trustRow("Established", SITE.yearEstablished));
    var rv = SITE.reviews || {};
    if (rv.rating && rv.count) {
      var row = el("div", "trust-panel__row trust-panel__row--rating");
      var dt = el("dt", "trust-panel__k"); txt(dt, "Google rating");
      var dd = el("dd", "trust-panel__v trust-panel__v--rating");
      dd.appendChild(stars(rv.rating, "stars--sm"));
      var num = el("span", "trust-panel__num"); txt(num, rv.rating + " · " + rv.count);
      dd.appendChild(num);
      row.appendChild(dt); row.appendChild(dd); tp.appendChild(row);
    }
    var st = arr(SITE.stats)[0];
    if (st) tp.appendChild(trustRow(st.label, st.value));
    if (has(h.imageCaption)) { txt($("hero-caption"), h.imageCaption); show($("hero-caption")); }
  }
  function trustRow(k, v) {
    var row = el("div", "trust-panel__row");
    var dt = el("dt", "trust-panel__k"); txt(dt, k);
    var dd = el("dd", "trust-panel__v"); txt(dd, v);
    row.appendChild(dt); row.appendChild(dd); return row;
  }

  function paintNotice() {
    var n = SITE.notice || {};
    if (!has(n.heading) && !has(n.body)) return;
    var sec = $("notice");
    var iconWrap = sec.querySelector(".notice__icon");
    if (iconWrap) iconWrap.appendChild(svgIcon("spark", "icon"));
    txt($("notice-heading"), n.heading || "");
    txt($("notice-body"), n.body || "");
    show(sec);
  }

  function paintTrustbar() {
    var inner = $("trustbar-inner");
    if (!inner) return;
    var pieces = [];
    var rv = SITE.reviews || {};
    if (rv.rating && rv.count) {
      var d = el("div", "trustbar__item trustbar__item--rating");
      d.appendChild(stars(rv.rating, "stars--sm"));
      var span = el("span", "trustbar__text");
      txt(span, rv.rating + " (" + rv.count + " Google reviews)");
      d.appendChild(span); pieces.push(d);
    }
    if (has(SITE.area)) pieces.push(trustbarItem("pin", "Serving " + SITE.area));
    if (has(SITE.yearEstablished)) pieces.push(trustbarItem("shield", "Established " + SITE.yearEstablished));
    arr(SITE.credentials).slice(0, 4).forEach(function (c) {
      var d = el("div", "trustbar__item");
      var b = el("span", "badge"); txt(b, c); d.appendChild(b); pieces.push(d);
    });
    if (!pieces.length) return;
    clear(inner);
    pieces.forEach(function (p) { inner.appendChild(p); });
    show($("trustbar"));
  }
  function trustbarItem(icon, label) {
    var d = el("div", "trustbar__item");
    d.appendChild(svgIcon(icon, "icon"));
    var span = el("span", "trustbar__text"); txt(span, label);
    d.appendChild(span); return d;
  }

  function paintAboutTeaser() {
    var a = SITE.about || {};
    if (has(a.kicker)) { txt($("about-teaser-kicker"), a.kicker); show($("about-teaser-kicker")); }
    txt($("about-teaser-heading"), a.heading || "About us");
    txt($("about-teaser-text"), a.teaser || a.body || "");
    var bl = $("about-teaser-bullets");
    var bullets = arr(a.bullets).slice(0, 4);
    if (bullets.length) {
      clear(bl); show(bl);
      bullets.forEach(function (b) {
        var li = el("li", "ticklist__item");
        li.appendChild(svgIcon("check", "icon"));
        var span = el("span"); txt(span, b); li.appendChild(span);
        bl.appendChild(li);
      });
    }
    var link = $("about-teaser-link");
    if (link) { link.href = "about.html"; }
    // owner card
    var o = a.owner || {};
    if (has(o.name)) {
      show($("about-owner"));
      txt($("owner-initials"), initialsFrom(o.name, o.initials));
      txt($("owner-name"), o.name);
      txt($("owner-title"), o.title || "");
      txt($("owner-cred"), o.credential || "");
    }
  }

  function paintServices() {
    var s = SITE.services || {};
    if (has(s.kicker)) { txt($("services-kicker"), s.kicker); show($("services-kicker")); }
    txt($("services-heading"), s.heading || "Services");
    if (has(s.intro)) { txt($("services-intro"), s.intro); show($("services-intro")); }
    var grid = $("services-grid");
    clear(grid);
    arr(s.items).forEach(function (item) {
      var card = el("article", "card service-card");
      var ic = el("span", "card__icon");
      ic.appendChild(svgIcon(item.icon, "icon"));
      card.appendChild(ic);
      var h = el("h3", "card__title"); txt(h, item.title); card.appendChild(h);
      var p = el("p", "card__body"); txt(p, item.body); card.appendChild(p);
      grid.appendChild(card);
    });
  }

  function paintAudiences() {
    var a = SITE.audiences || {};
    if (!arr(a.items).length) return;
    txt($("audiences-heading"), a.heading || "Who we help");
    if (has(a.intro)) { txt($("audiences-intro"), a.intro); show($("audiences-intro")); }
    var grid = $("audiences-grid");
    clear(grid);
    a.items.forEach(function (item) {
      var card = el("article", "card audience-card");
      var ic = el("span", "card__icon");
      ic.appendChild(svgIcon(item.icon, "icon"));
      card.appendChild(ic);
      var h = el("h3", "card__title"); txt(h, item.title); card.appendChild(h);
      var p = el("p", "card__body"); txt(p, item.body); card.appendChild(p);
      if (arr(item.bullets).length) {
        var ul = el("ul", "ticklist ticklist--sm");
        item.bullets.forEach(function (b) {
          var li = el("li", "ticklist__item");
          li.appendChild(svgIcon("check", "icon"));
          var span = el("span"); txt(span, b); li.appendChild(span);
          ul.appendChild(li);
        });
        card.appendChild(ul);
      }
      grid.appendChild(card);
    });
    show($("audiences"));
  }

  function paintProcess() {
    var p = SITE.process || {};
    if (!arr(p.steps).length) return;
    txt($("process-heading"), p.heading || "How we work");
    if (has(p.intro)) { txt($("process-intro"), p.intro); show($("process-intro")); }
    var ol = $("process-steps");
    clear(ol);
    p.steps.forEach(function (step, i) {
      var li = el("li", "step");
      var num = el("span", "step__num"); txt(num, i + 1); li.appendChild(num);
      var h = el("h3", "step__title"); txt(h, step.title); li.appendChild(h);
      var body = el("p", "step__body"); txt(body, step.body); li.appendChild(body);
      ol.appendChild(li);
    });
    show($("process"));
  }

  function paintPricing() {
    var p = SITE.pricing || {};
    if (!arr(p.tiers).length) return;
    txt($("pricing-heading"), p.heading || "Engagements");
    if (has(p.intro)) { txt($("pricing-intro"), p.intro); show($("pricing-intro")); }
    var grid = $("pricing-grid");
    clear(grid);
    p.tiers.forEach(function (t) {
      var card = el("article", "card price-card" + (t.featured ? " price-card--featured" : ""));
      if (t.featured) { var tag = el("span", "price-card__tag"); txt(tag, "Most popular"); card.appendChild(tag); }
      var h = el("h3", "price-card__name"); txt(h, t.name); card.appendChild(h);
      var price = el("p", "price-card__price");
      var big = el("span", "price-card__amount"); txt(big, t.price); price.appendChild(big);
      if (has(t.period)) { var per = el("span", "price-card__period"); txt(per, " " + t.period); price.appendChild(per); }
      card.appendChild(price);
      if (arr(t.features).length) {
        var ul = el("ul", "ticklist ticklist--sm");
        t.features.forEach(function (fe) {
          var li = el("li", "ticklist__item");
          li.appendChild(svgIcon("check", "icon"));
          var span = el("span"); txt(span, fe); li.appendChild(span);
          ul.appendChild(li);
        });
        card.appendChild(ul);
      }
      var cta = el("a", "btn btn--secondary btn--block");
      txt(cta, t.cta || "Get in touch");
      cta.href = (SITE.ctaSecondary && SITE.ctaSecondary.href) || "index.html#contact";
      card.appendChild(cta);
      grid.appendChild(card);
    });
    show($("pricing"));
  }

  function paintReviews() {
    var r = SITE.reviews || {};
    var hasAggregate = r.rating && r.count;
    var items = arr(r.items);
    if (!hasAggregate && !items.length) return;
    txt($("reviews-heading"), r.heading || "What clients say");
    // aggregate
    var agg = $("reviews-aggregate");
    clear(agg);
    if (hasAggregate) {
      var num = el("span", "reviews__rating"); txt(num, r.rating);
      agg.appendChild(num);
      agg.appendChild(stars(r.rating, "stars--lg"));
      var count = el("span", "reviews__count"); txt(count, "(" + r.count + " Google reviews)");
      agg.appendChild(count);
    }
    txt($("reviews-source"), r.sourceLabel || "Reviews from Google");
    // grid
    var grid = $("reviews-grid");
    clear(grid);
    items.forEach(function (rev, idx) {
      var card = el("article", "card review-card" + (idx === 0 ? " review-card--feature" : ""));
      var head = el("div", "review-card__head");
      var av = el("span", "avatar avatar--sm");
      if (has(rev.photoUrl)) {
        var img = el("img", "avatar__img");
        img.src = rev.photoUrl; img.alt = ""; img.loading = "lazy";
        img.setAttribute("referrerpolicy", "no-referrer");
        av.appendChild(img); av.classList.add("avatar--photo");
      } else {
        txt(av, initialsFrom(rev.author, ""));
      }
      head.appendChild(av);
      var meta = el("div", "review-card__meta");
      var nameNode;
      if (has(rev.authorUrl)) {
        nameNode = el("a", "review-card__author");
        nameNode.href = rev.authorUrl; nameNode.target = "_blank"; nameNode.rel = "noopener";
      } else {
        nameNode = el("span", "review-card__author");
      }
      txt(nameNode, (rev.author || "").trim());
      meta.appendChild(nameNode);
      var sub = el("div", "review-card__sub");
      sub.appendChild(stars(rev.rating, "stars--sm"));
      if (has(rev.date)) { var dt = el("span", "review-card__date"); txt(dt, rev.date); sub.appendChild(dt); }
      meta.appendChild(sub);
      head.appendChild(meta);
      var q = svgIcon("quote", "review-card__quote"); head.appendChild(q);
      card.appendChild(head);
      var body = el("p", "review-card__text"); txt(body, rev.text); card.appendChild(body);
      grid.appendChild(card);
    });
    if (!items.length) hide(grid);
    var all = $("reviews-all");
    var mapsUrl = r.mapsUrl || SITE.mapsUrl;
    if (has(mapsUrl)) { all.href = mapsUrl; show(all); }
    show($("reviews"));
  }

  function paintFaq() {
    var f = SITE.faq || {};
    if (!arr(f.items).length) return;
    txt($("faq-heading"), f.heading || "Questions");
    var list = $("faq-list");
    clear(list);
    f.items.forEach(function (item) {
      var d = el("details", "faq__item");
      var s = el("summary", "faq__q");
      var span = el("span"); txt(span, item.q); s.appendChild(span);
      s.appendChild(svgIcon("check", "faq__chevron")); // decorative marker
      d.appendChild(s);
      var a = el("div", "faq__a");
      var p = el("p"); txt(p, item.a); a.appendChild(p);
      d.appendChild(a);
      list.appendChild(d);
    });
    show($("faq"));
  }

  function paintContact() {
    var c = SITE.contact || {};
    txt($("contact-heading"), c.heading || "Contact us");
    if (has(c.body)) { txt($("contact-body"), c.body); show($("contact-body")); }
    var form = $("contact-form");
    if (form && c.formEnabled !== false) {
      show(form);
      var sel = $("cf-service");
      if (sel) {
        clear(sel);
        var def = el("option"); def.value = ""; txt(def, "Select a service…"); sel.appendChild(def);
        arr(SITE.services && SITE.services.items).forEach(function (s) {
          var o = el("option"); o.value = s.title; txt(o, s.title); sel.appendChild(o);
        });
      }
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!has(SITE.email)) return;
        var name = ($("cf-name").value || "").trim();
        var email = ($("cf-email").value || "").trim();
        var phone = ($("cf-phone").value || "").trim();
        var service = ($("cf-service").value || "").trim();
        var msg = ($("cf-message").value || "").trim();
        var subject = "Website enquiry" + (service ? " — " + service : "");
        var bodyLines = [
          "Name: " + name,
          "Email: " + email,
          phone ? "Phone: " + phone : "",
          service ? "Service: " + service : "",
          "",
          msg
        ].filter(function (l) { return l !== ""; });
        var url = "mailto:" + SITE.email +
          "?subject=" + encodeURIComponent(subject) +
          "&body=" + encodeURIComponent(bodyLines.join("\n"));
        window.location.href = url;
      });
    }
    // aside
    var aside = $("contact-aside");
    if (aside) {
      clear(aside);
      if (has(SITE.address)) aside.appendChild(contactLine("pin", "Address", SITE.address, SITE.mapsUrl));
      if (has(SITE.phone)) aside.appendChild(contactLine("phone", "Phone", SITE.phone, telHref(SITE.phone)));
      if (has(SITE.email)) aside.appendChild(contactLine("user", "Email", SITE.email, "mailto:" + SITE.email));
      if (arr(SITE.hours).length) aside.appendChild(hoursBlock());
    }
  }
  function contactLine(icon, label, value, href) {
    var row = el("div", "contact-line");
    var ic = el("span", "contact-line__icon"); ic.appendChild(svgIcon(icon, "icon"));
    row.appendChild(ic);
    var body = el("div", "contact-line__body");
    var lab = el("span", "contact-line__label"); txt(lab, label); body.appendChild(lab);
    var val;
    if (has(href)) {
      val = el("a", "contact-line__value");
      val.href = href;
      if (/^https?:/.test(href)) { val.target = "_blank"; val.rel = "noopener"; }
    } else {
      val = el("span", "contact-line__value");
    }
    txt(val, value); body.appendChild(val);
    row.appendChild(body);
    return row;
  }
  function hoursBlock() {
    var row = el("div", "contact-line");
    var ic = el("span", "contact-line__icon"); ic.appendChild(svgIcon("clock", "icon"));
    row.appendChild(ic);
    var body = el("div", "contact-line__body");
    var lab = el("span", "contact-line__label"); txt(lab, "Hours"); body.appendChild(lab);
    var dl = el("dl", "hours");
    arr(SITE.hours).forEach(function (h) {
      var d = el("div", "hours__row");
      var dt = el("dt"); txt(dt, h.day); var dd = el("dd"); txt(dd, h.time);
      d.appendChild(dt); d.appendChild(dd); dl.appendChild(d);
    });
    body.appendChild(dl);
    row.appendChild(body);
    return row;
  }

  /* ---------- ABOUT page ---------- */
  function paintAboutPage() {
    var a = SITE.about || {};
    if (has(a.kicker)) { txt($("about-hero-kicker"), a.kicker); show($("about-hero-kicker")); }
    txt($("about-hero-title"), a.heading || ("About " + (SITE.business || "us")));
    if (has(a.teaser)) { txt($("about-hero-lead"), a.teaser); show($("about-hero-lead")); }
    // story body
    var body = $("story-body");
    clear(body);
    if (has(a.body)) {
      String(a.body).split(/\n\s*\n/).forEach(function (para) {
        if (!para.trim()) return;
        var p = el("p", "story__para"); txt(p, para.trim()); body.appendChild(p);
      });
    }
    var bullets = arr(a.bullets);
    if (bullets.length) {
      var ul = el("ul", "ticklist");
      bullets.forEach(function (b) {
        var li = el("li", "ticklist__item");
        li.appendChild(svgIcon("check", "icon"));
        var span = el("span"); txt(span, b); li.appendChild(span);
        ul.appendChild(li);
      });
      body.appendChild(ul);
    }
    // stats
    var stats = arr(SITE.stats);
    if (stats.length) {
      var wrap = $("story-stats");
      clear(wrap); show(wrap);
      stats.forEach(function (s) {
        var d = el("div", "stat");
        var v = el("span", "stat__value"); txt(v, s.value); d.appendChild(v);
        var l = el("span", "stat__label"); txt(l, s.label); d.appendChild(l);
        wrap.appendChild(d);
      });
    }
    // owner
    var o = a.owner || {};
    if (has(o.name)) {
      show($("about-owner-section"));
      txt($("about-owner-initials"), initialsFrom(o.name, o.initials));
      txt($("about-owner-name"), o.name);
      txt($("about-owner-title"), o.title || "");
      txt($("about-owner-cred"), o.credential || "");
    }
    // values
    var values = arr(a.values);
    if (values.length) {
      var grid = $("values-grid");
      clear(grid);
      values.forEach(function (v) {
        var card = el("article", "card value-card");
        var ic = el("span", "card__icon"); ic.appendChild(svgIcon("spark", "icon")); card.appendChild(ic);
        var h = el("h3", "card__title"); txt(h, v.title); card.appendChild(h);
        var p = el("p", "card__body"); txt(p, v.body); card.appendChild(p);
        grid.appendChild(card);
      });
      show($("about-values"));
    }
    // credentials + areas
    var creds = arr(SITE.credentials);
    var areas = arr(SITE.serviceAreas);
    if (creds.length || areas.length) {
      show($("about-creds"));
      if (creds.length) {
        var cl = $("creds-list"); clear(cl);
        creds.forEach(function (c) { var li = el("li", "badge badge--lg"); txt(li, c); cl.appendChild(li); });
        show($("creds-block"));
      }
      if (areas.length) {
        var al = $("areas-list"); clear(al);
        var head = [SITE.area].concat(areas).filter(has);
        head.forEach(function (city) {
          var li = el("li", "arealist__item");
          li.appendChild(svgIcon("pin", "icon"));
          var span = el("span"); txt(span, city); li.appendChild(span);
          al.appendChild(li);
        });
        show($("areas-block"));
      }
    }
    // CTA band
    var c = SITE.contact || {};
    txt($("about-cta-heading"), c.heading || "Let's talk");
    if (has(c.body)) { txt($("about-cta-body"), c.body); show($("about-cta-body")); }
    var p = SITE.ctaPrimary || {}, s = SITE.ctaSecondary || {};
    var cp = $("about-cta-primary");
    txt(cp, p.label || "Call now");
    cp.href = (p.href === "tel:" || !has(p.href)) ? telHref(SITE.phone) : p.href;
    if (!has(SITE.phone) && (!has(p.href) || p.href === "tel:")) hide(cp);
    var cs = $("about-cta-secondary");
    txt(cs, s.label || "Contact");
    cs.href = s.href || "index.html#contact";
    var contact = $("about-cta-contact");
    clear(contact);
    if (has(SITE.phone)) contact.appendChild(ctaContactItem(telHref(SITE.phone), SITE.phone));
    if (has(SITE.email)) contact.appendChild(ctaContactItem("mailto:" + SITE.email, SITE.email));
    if (has(SITE.address)) { var li = el("li"); txt(li, SITE.address); contact.appendChild(li); }
  }
  function ctaContactItem(href, label) {
    var li = el("li");
    var a = el("a"); a.href = href; txt(a, label);
    li.appendChild(a); return li;
  }

  /* ---------- meta ---------- */
  function paintMeta() {
    var page = doc.documentElement.getAttribute("data-page");
    if (has(SITE.lang)) doc.documentElement.setAttribute("lang", SITE.lang);
    var name = SITE.business || "Site preview";
    if (page === "about") {
      doc.title = "About — " + name;
    } else {
      doc.title = name + (has(SITE.tagline) ? " — " + SITE.tagline : "");
    }
  }

  /* ---------- boot ---------- */
  function init() {
    applyColors();
    initDesign();
    paintMeta();
    paintSwitcher();
    paintLogo();
    paintNav();
    paintCallbar();
    paintFooter();
    initMobileNav();
    var page = doc.documentElement.getAttribute("data-page");
    if (page === "about") {
      paintAboutPage();
    } else {
      paintHero();
      paintNotice();
      paintTrustbar();
      paintAboutTeaser();
      paintServices();
      paintAudiences();
      paintProcess();
      paintPricing();
      paintReviews();
      paintFaq();
      paintContact();
    }
  }

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
