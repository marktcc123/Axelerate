/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  /**
   * Dev: allow /_next/* when the browser Origin is not localhost (e.g. phone on LAN).
   * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
   */
  allowedDevOrigins: [
    "local-origin.dev",
    "*.local-origin.dev",
    "192.168.8.24",
    "192.168.8.*",
    /* 常见家用路由网段（手机 IP 若与电脑不同段也能过 /_next 校验） */
    "192.168.*.*",
    "10.*.*.*",
  ],
}

export default nextConfig
