/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // This app lives in a subfolder of the CRM repo (two lockfiles).
  turbopack: {
    root: import.meta.dirname,
  },
}

export default nextConfig
