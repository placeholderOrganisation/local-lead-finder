// Tiny vCard (RFC 6350 / vCard 3.0) formatter for phone-first outreach.
// vCard 3.0 for broad compatibility (macOS/iOS Contacts, Google Contacts).
// Idea borrowed from Prospex (MIT) — see docs/prior-art.md.

/**
 * Serialize lead docs into a single .vcf payload (one card per lead).
 * @param {Array<object>} leads canonical lead documents.
 * @returns {string}
 */
export function toVCards(leads) {
  return leads.map(vcardFor).join("\r\n") + "\r\n";
}

function vcardFor(l) {
  const business = l.business || "";
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${esc(business)}`];
  if (business) lines.push(`ORG:${esc(business)}`);
  if (l.phone) lines.push(`TEL;TYPE=WORK,VOICE:${esc(l.phone)}`);
  if (l.email) lines.push(`EMAIL;TYPE=WORK:${esc(l.email)}`);
  if (l.website) lines.push(`URL:${esc(l.website)}`);
  // ADR structured value: PO;ext;street;locality;region;postal;country.
  if (l.address) lines.push(`ADR;TYPE=WORK:;;${esc(l.address)};;;;`);
  const note = noteFor(l);
  if (note) lines.push(`NOTE:${esc(note)}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

function noteFor(l) {
  const bits = [];
  if (l.pitch) bits.push(l.pitch);
  const issues = Array.isArray(l.issues) ? l.issues.join("; ") : l.issues || "";
  if (issues) bits.push(`Issues: ${issues}`);
  if (l.category) bits.push(`Category: ${l.category}`);
  return bits.join(" \u2014 ");
}

// RFC 6350 text escaping: backslash, newline, comma, semicolon.
function esc(v) {
  return String(v == null ? "" : v)
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
