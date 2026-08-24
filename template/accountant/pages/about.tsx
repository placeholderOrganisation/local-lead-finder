import Head from "next/head"
import { SiteApp } from "@/components/site-app"

/** Same SPA as `/` — export emits about/index.html for `/about/` without a placeId. */
export default function AboutPage() {
  return (
    <>
      <Head>
        <title>Preview / mockup</title>
      </Head>
      <SiteApp />
    </>
  )
}
