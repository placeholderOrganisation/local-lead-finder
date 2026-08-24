import Head from "next/head"
import { SiteApp } from "@/components/site-app"

/** Same SPA as `/` — export emits contact/index.html for `/contact/` without a placeId. */
export default function ContactPage() {
  return (
    <>
      <Head>
        <title>Preview / mockup</title>
      </Head>
      <SiteApp />
    </>
  )
}
