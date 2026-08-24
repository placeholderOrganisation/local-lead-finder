import Head from "next/head"
import { SiteApp } from "@/components/site-app"

/** Same SPA as `/` so static hosts that serve 404.html still hydrate the app. */
export default function NotFoundPage() {
  return (
    <>
      <Head>
        <title>Preview / mockup</title>
      </Head>
      <SiteApp />
    </>
  )
}
