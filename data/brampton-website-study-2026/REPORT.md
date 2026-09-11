# The State of Brampton Business Websites: A 2026 Study

**Subtitle:** An original measurement study of independently operated small- and medium-sized business websites serving Brampton, Ontario.

**Publisher:** Mintek Software (Brampton, Ontario)  
**Fieldwork dates:** 11 September 2026  
**Sample (after quality control):** 93 businesses  
**Lighthouse / PageSpeed coverage:** 76 of 93 homepages  

This document distinguishes **observed fact** (counts and tool output) from **interpretation** (what those measurements may mean for a typical visitor or search system).

---

## A. Executive summary

On 11 September 2026 we measured publicly accessible homepages for Brampton businesses drawn from Google Places searches across twelve industry groups. After removing national chains, a municipal facility, a dead domain, a large national HVAC brand, and a listing whose “website” was a TikTok profile, **93** independently operated sites remained. **87** homepages returned HTML that our crawler could inspect. **76** completed Google’s PageSpeed Insights mobile Lighthouse run.

Among those 76 scored homepages, the **median Lighthouse performance score was 56.5** (mean 58.5). **25 of 76 (32.9%)** scored below 50; **8 of 76 (10.5%)** scored 90 or above. The median **Largest Contentful Paint was 8.3 seconds**. **73 of 76 (96.1%)** had LCP slower than Google’s 2.5-second “good” threshold for that metric. Median transferred homepage weight among scored sites was about **3.3 MB**, with a median of **86** network requests.

These performance numbers sit beside stronger on-page hygiene in other Lighthouse categories: median **SEO 92**, **best practices 96**, and **accessibility 88.5**. Automated accessibility scores are not WCAG certification; they only reflect Lighthouse’s checks.

On the 87 homepages we could fetch, **85 (97.7%)** used HTTPS. **43 (49.4%)** showed WordPress signals (`wp-content` or a WordPress generator). JSON-LD or other schema.org blocks were detected on **54 (62.1%)**, but types consistent with LocalBusiness / Organization (including profession-specific subtypes) appeared on **36 (41.4%)**. **72 (82.8%)** mentioned Brampton in homepage text. A click-to-call `tel:` link was present on **58 (66.7%)**. A `<form>` appeared on **47 (54.0%)**. An obvious primary CTA phrase (for example “call now”, “contact us”, “book now”) appeared on **71 (81.6%)**. Dedicated service-section links were detected on **42 (48.3%)**. Homepage testimonials or review blocks matching our text patterns appeared on only **17 (19.1%)**. On-page pricing language was rare (**4 of 87, 4.5%**), which is expected for many professional services and is not treated here as a defect.

XML sitemaps responded at a guessed or robots.txt-advertised URL for **77 of 87 (88.5%)**. A `robots.txt` file was found for **69 (79.3%)**. Canonical tags were present on **69 (79.3%)**.

PageSpeed scores **tended to be lower** on heavier pages. Across scored sites with both metrics, Pearson correlation between performance score and page bytes was **-0.54**, and between performance score and request count was **-0.62**. That is an association, not proof that bytes cause the score. WordPress sites with a score (n=35 in the pre-final cut) had a median performance near the overall median; Shopify’s median was pulled by both a high-scoring small storefront and a very heavy jewellery catalogue.

Industry slices are small. Legal homepages that scored (n=8) had the highest median performance in this sample (70.5 in the pre-trim industry table). Real estate (n=7 scored) and education (n=6) sat lower. Fitness collapsed to two independent gyms after chain and municipal removals, so no fitness ranking is reported.

The practical pattern is consistent: most of these sites are on HTTPS, have titles, and often have sitemaps and some analytics script. The gaps that show up in the measurements are **mobile load (especially LCP)**, **inconsistent LocalBusiness structured data**, **inconsistent click-to-call**, and **thin homepage proof** (reviews, hours, service-area architecture). None of these measurements rank a business in Google, and none of them describe how well the company serves customers offline.

---

## B. Methodology

### How businesses were selected

1. Google Places API (New) Text Search for `{category} in Brampton, ON`, using Mintek’s Local Lead Finder client (`websiteUri`, phone, address, rating, Place ID).
2. Existing CRM leads for accountants, plumbers, and roofers were reused instead of repeating those searches.
3. Keep rules (applied before measurement):
   - `formattedAddress` contains “Brampton”
   - operational (Places `businessStatus`)
   - has a website that is not Facebook, Instagram, Linktree, or Google’s free site builders (Lead Finder AUDIT tier)
   - hostname unique within the sample
   - name does not match a national QSR / big-box denylist
   - per-search caps so one category does not dominate (for example 6 dentists, 8 lawyers, 10 restaurants)
4. Quality control after measurement removed: Planet Fitness, Fit4Less, Brampton YMCA, Indigo Brampton, Speedy Auto Service, Cassie Campbell Community Centre (municipal), Heal360 (DNS failure), Enercare (national brand), Maharaja Jewellers (Places `websiteUri` was TikTok).

We did **not** sample only weak websites. Within each search, eligible businesses were ordered by Google review count (a proxy for an established local presence), then the cap was applied.

### Sample size

- Drawn from Places: 102 listings with websites  
- **Analysis sample: 93** after QC  
- HTML inspection succeeded: **87 / 93**  
- PageSpeed Insights succeeded: **76 / 93**  
- Remaining PageSpeed gaps are recorded as `not available` (timeouts, 403 bot blocks, or document load failures). They are **not** imputed.

### Testing dates and tools

| Item | Detail |
|---|---|
| Date | 11 September 2026 |
| Place discovery | Google Places API (New) Text Search |
| HTML inspection | `GET` homepage, `/robots.txt`, sitemap URL from robots or `/sitemap.xml`, User-Agent `BramptonWebsiteStudy/2026` |
| Performance | PageSpeed Insights API v5, `strategy=mobile`, categories performance / accessibility / best-practices / SEO |
| One run per URL | Not a median of three lab runs |
| Network vantage | PSI runs in Google’s infrastructure; HTML fetch ran from the researcher’s machine |
| No contact | No forms submitted, no accounts, no purchases, no phone calls |

### Metric definitions (observed)

- **Lighthouse category scores:** 0–100 as returned by PSI for that run.  
- **LCP / FCP:** seconds, PSI `numericValue`.  
- **TBT:** milliseconds. **CLS:** unitless.  
- **Page size / requests:** PSI total-byte-weight and network-requests audit when PSI succeeded.  
- **CMS / analytics / schema:** pattern matching on HTML (false positives and false negatives are possible). GA4 detection in particular may fire on third-party widgets that load `gtag.js`.  
- **Click-to-call:** presence of `href="tel:…"`.  
- **Contact form:** presence of a `<form>` element (may include newsletter or search forms).  
- **Primary CTA:** first matching phrase from a fixed list.  
- **LocalBusiness schema:** JSON-LD `@type` matching LocalBusiness, Organization, or common professional subtypes.

### Limitations

- Convenience sample of businesses that appear in Places for the chosen queries, not a census of all Brampton firms.  
- Businesses without websites were excluded by design (this study is about websites).  
- Industry cells are often n&lt;10; medians are descriptive only.  
- Single PSI run; scores vary by day and by Google’s test agents.  
- HTML inspect can receive 403 from WAFs that still serve humans (and sometimes still serve PSI).  
- Fitness independent-site coverage is too thin to compare.  
- Enercare-style national brands can still leak in if the denylist misses them; Enercare was removed in the final SMB file.  
- Correlation is not causation.

---

## C. Key findings

All percentages below use the stated denominator. Performance findings use **n=76** scored homepages. On-page HTML findings use **n=87** successfully fetched homepages unless noted.

1. **Median mobile Lighthouse performance was 56.5** (mean 58.5).  
2. **32.9% (25/76)** scored below 50; **10.5% (8/76)** scored 90 or above.  
3. **Median LCP was 8.3 seconds; 96.1% (73/76)** exceeded 2.5s.  
4. **Median homepage transfer was ~3.3 MB** with **median 86 requests**.  
5. **Performance score tended to fall as pages got heavier** (r = −0.54 vs bytes, r = −0.62 vs requests, scored sites).  
6. **97.7% (85/87)** of fetched homepages used HTTPS. **4.5% (4/87)** lacked a viewport meta tag.  
7. **WordPress signals appeared on 49.4% (43/87)** of fetched homepages.  
8. **JSON-LD/schema was detected on 62.1% (54/87)**; **LocalBusiness/Organization-like types on 41.4% (36/87)**.  
9. **Click-to-call was present on 66.7% (58/87)**; a `<form>` on **54.0% (47/87)**; a listed CTA phrase on **81.6% (71/87)**.  
10. **Brampton appeared in homepage text on 82.8% (72/87)**. Service-section links: **48.3% (42/87)**.  
11. **XML sitemap probe succeeded for 88.5% (77/87)**; **robots.txt for 79.3% (69/87)**; canonical tags **79.3% (69/87)**.  
12. **Homepage testimonial/review patterns: 19.1% (17/87)**. Pricing language: **4.5% (4/87)**.  
13. **Median Lighthouse SEO 92, best practices 96, accessibility 88.5** — lab category scores, not ranking proof and not a full accessibility audit.  
14. **gtag/GA4-like script signatures were common (93.1%)**; treat as “script detected,” not as proof of a well-configured GA4 property. GTM: **26.4% (23/87)**.

---

## D. Industry breakdown

Place counts are after QC. Lighthouse medians are only for sites that returned a score. Cells with scored n&lt;5 are marked as **indicative**.

| Industry | Sites in sample | Lighthouse n | Median performance (indicative if n&lt;5) |
|---|---:|---:|---:|
| Dental/medical | 14 | 10 | 56 |
| Legal | 8 | 8 | 70.5 |
| Accounting | 8 | 6 | 58 |
| Home services | 9 | 6 | ~55 |
| Construction/renovation | 8 | 4 | 57.5 (indicative) |
| Restaurants | 10 | 9 | 56 |
| Beauty/personal care | 8 | 7 | 56 |
| Automotive | 6 | 4 | 56 (indicative) |
| Real estate | 7 | 7 | 45 |
| Education | 6 | 6 | 46 |
| Retail | 7 | 6 | ~54 |
| Fitness | 2 | 2 | not reported |

**Observed pattern:** legal sites in this sample clustered higher on performance; real estate and education clustered lower. **Interpretation:** those groups often ship image-heavy templates and listing widgets; this dataset cannot prove that industry causes the score.

---

## E. Performance analysis

Distribution among **76** mobile PSI runs (11 September 2026):

- Minimum in sample (SMB file): 22 (Punjab Jewellers)  
- 25th percentile (earlier cut): 42  
- **Median: 56.5**  
- 75th percentile (earlier cut): 72  
- Maximum in sample: 98 (Mahek Beauty Salon)

**LCP:** median 8.3s. Almost every scored homepage failed the 2.5s LCP threshold on this run.  
**CLS:** median was low (~0.01 in the prior cut); a minority exceeded 0.1.  
**FCP:** median 3.4s (prior cut). **TBT:** median 196 ms (prior cut).

Sites at the bottom of the performance list were often large: Punjab Jewellers ~11.8 MB / 262 requests / LCP 35.5s; German Sandhu Realtor ~12.4 MB / 137 requests / LCP 31.2s; Tandoori Flame Brampton ~15.1 MB / LCP 41.4s.

---

## F. Local SEO analysis

**Common strengths (fetched homepages):** HTTPS, title tags (96.6% in prior cut), Brampton mentioned on the homepage, sitemaps often present, Lighthouse SEO category often high.

**Common gaps:** LocalBusiness/Organization JSON-LD on a minority (41.4%); service-section architecture under half; meta description and H1 not universal (~73% and ~72% in the prior cut); NAP/hours incomplete on many homepages (hours pattern 58.4% prior cut).

Absence of a given signal is recorded as absence. It is **not** coded as “bad SEO.”

---

## G. Conversion analysis

Among fetched homepages:

- Visible CTA phrase: **81.6%**  
- Click-to-call: **66.7%**  
- `<form>`: **54.0%**  
- Booking-related third party or “book/schedule” language: **~30%** (prior cut)  
- Testimonials/review wording: **19.1%**

A restaurant without a quote form is not penalized in this study; we report presence only. Some `<form>` hits may be search or newsletter forms.

Scored sites **with** a detected CTA had a slightly **lower** median performance (55.5) than those without (65.5) in the prior cut (n=14 without CTA). **Interpretation:** marketing widgets and popups can coexist with CTAs and extra script; this is not evidence that CTAs slow pages.

---

## H. Technical analysis

CMS signals on fetched HTML:

- WordPress **49.4%**  
- Shopify **~7%**  
- Wix **~3%**  
- Squarespace **~2%**  
- Webflow **~1%**  
- Remainder not identified (custom, opaque builders, or insufficient markers)

HTTP/2 vs HTTP/3 was **not reliably recorded** in this pass (`not available` unless PSI exposed it). CDN detection from HTML is incomplete (many CDNs leave no obvious hostname).

---

## I. Interesting examples

Factual snapshots from 11 September 2026. These are not reviews of the businesses.

1. **Mahek Beauty Salon** — Lighthouse performance **98** (mobile PSI).  
2. **Rathod Law Firm** (https://www.rathodlaw.com/) — performance **96**, SEO **100**, accessibility **96**; JSON-LD LocalBusiness was **not** detected on that snapshot.  
3. **Kesar Sweets & Restaurant** — performance **93** on WordPress, LocalBusiness schema **detected**, click-to-call and form present, LCP **3.0s** (still above 2.5s).  
4. **Tikka Junction** — performance **94**.  
5. **Goldy Laser and Spa** — performance **95**.  
6. **1 Stop Auto Repair Centre Brampton** — performance **90**, LocalBusiness schema detected.  
7. **Salvaggio Dentistry** — conversion signals present (tel, form, CTA, Brampton, schema) with performance **34** and LCP **17.3s**. Useful as “strong conversion markup, heavy lab load.”  
8. **Complete Physio & Sports Rehab** — performance **79**, smaller page (~0.63 MB, 31 requests), tel + form + CTA.  
9. **Punjab Jewellers** — Shopify, LocalBusiness schema detected, performance **22**, ~11.8 MB, 262 requests, CLS **1.007**, LCP **35.5s**.  
10. **German Sandhu Realtor** — WordPress, performance **24**, ~12.4 MB, 137 requests, LCP **31.2s**, no detected primary CTA phrase, tel and form present.

---

## J. Recommendations

Highest-leverage items **for a typical Brampton SMB homepage**, based only on what was common in this sample:

1. **Reduce LCP:** compress/resize hero media; avoid multi-megabyte homepage payloads (median was already ~3.3 MB).  
2. **Keep HTTPS and viewport** (already typical; the few HTTP or no-viewport cases are straightforward fixes).  
3. **Add a `tel:` link** if the business takes phone leads (missing on about one-third of fetched homepages).  
4. **Publish LocalBusiness/Organization JSON-LD** with name, address, telephone, and opening hours when those facts are public (present on about two-fifths).  
5. **Say “Brampton” and the service area on the homepage** if that is accurate (about one-sixth of fetched pages did not).  
6. **Link to dedicated service pages** when the business has more than one offer.  
7. **Show hours and a small set of reviews** if they exist elsewhere (GBP, etc.) and rights allow.  
8. **Do not treat a high Lighthouse SEO category as “the site ranks.”** It mostly means titles, robots, and crawl basics passed the lab.

These are implementation notes, not a claim that any vendor is required.

---

## K. Publication outline

**Title:** The State of Brampton Business Websites: 2026  
**Subtitle:** Lab measurements of 93 independently operated local-business homepages

1. Executive summary (this study’s medians and the LCP finding)  
2. Why the study exists (local operators; public pages only)  
3. Methodology and limitations  
4. Sample composition table (industry counts)  
5. Charts to produce:  
   - Histogram of Lighthouse performance (n=76)  
   - Median performance by industry (hide n&lt;5 or mark indicative)  
   - Presence/absence bars: HTTPS, schema, LocalBusiness, tel, form, sitemap, Brampton mention  
   - Scatter: page bytes vs performance  
6. Local SEO section  
7. Conversion section  
8. Ten examples with scores and URLs  
9. Recommendations  
10. Open dataset (CSV) and codebook  
11. Conclusion: most sites are “online enough” on paper; few meet Core Web Vitals LCP in this lab run  

---

## L. Data export

| File | Contents |
|---|---|
| `local-lead-finder/data/brampton-website-study-2026/dataset.csv` | All 102 measured rows including later exclusions |
| `dataset-smb.csv` / `dataset-smb.json` | 93-row analysis sample |
| `measurements.jsonl` | Raw append-only PSI/HTML observations |
| `qc-summary.json` | Intermediate aggregates (pre-final drop of Enercare/TikTok) |
| Mintek copy | `mintek-client-onboarding/research/brampton-website-study-2026/data/` |

Missing Lighthouse fields are the string `not available`. CRM label: `brampton-website-study-2026`.

---

## Conclusion

In this 11 September 2026 lab sample, Brampton SMB homepages usually had HTTPS, a title, and often a sitemap. What the instruments repeatedly showed was **slow mobile Largest Contentful Paint** and **incomplete machine-readable local business data**. Those are measurable homepage properties. They are not a verdict on the quality of the underlying business.
