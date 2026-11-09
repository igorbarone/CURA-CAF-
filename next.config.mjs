const repo = "CURA-CAF-";
const isPages = process.env.GITHUB_PAGES === "true";
// Two build targets share the same app:
// - static (default): `output: "export"` for GitHub Pages, no runtime code.
// - server (CURA_TARGET=server): Next.js runtime with commerce API routes.
// API route handlers are standard `route.ts` files in app/api; the static
// build (scripts/build-static.ts) moves that folder aside while it exports.
// On Vercel the platform reads this config by itself (without the npm
// script's CURA_TARGET) and expects the default `.next` output, so a Vercel
// build is always the server target.
const onVercel = process.env.VERCEL === "1";
const isServer = process.env.CURA_TARGET === "server" || onVercel;
/** @type {import('next').NextConfig} */
const nextConfig = isServer
  ? {
      env: {
        NEXT_PUBLIC_BASE_PATH: "",
        NEXT_PUBLIC_COMMERCE: process.env.CURA_COMMERCE ?? "disabled",
        NEXT_PUBLIC_MP_PUBLIC_KEY: process.env.MP_PUBLIC_KEY ?? "",
      },
      // Separate output so the static export and the server build never mix.
      distDir: onVercel ? ".next" : ".next-server",
      images: { unoptimized: true },
      trailingSlash: true,
      outputFileTracingIncludes: {
        "/api/**": ["./content/**/*", "./public/media/**/*", "./db/**/*"],
      },
      serverExternalPackages: ["@electric-sql/pglite", "pg"],
      async headers() {
        return [
          {
            source: "/:path*",
            headers: [
              { key: "X-Content-Type-Options", value: "nosniff" },
              {
                key: "Referrer-Policy",
                value: "strict-origin-when-cross-origin",
              },
              { key: "X-Frame-Options", value: "DENY" },
              {
                key: "Permissions-Policy",
                value: "camera=(), microphone=(), geolocation=()",
              },
            ],
          },
          {
            source: "/api/:path*",
            headers: [{ key: "Cache-Control", value: "no-store" }],
          },
        ];
      },
    }
  : {
      output: "export",
      env: {
        NEXT_PUBLIC_BASE_PATH: isPages ? `/${repo}` : "",
        NEXT_PUBLIC_COMMERCE: "disabled",
        NEXT_PUBLIC_MP_PUBLIC_KEY: "",
      },
      images: { unoptimized: true },
      trailingSlash: true,
      basePath: isPages ? `/${repo}` : "",
      assetPrefix: isPages ? `/${repo}/` : undefined,
    };
export default nextConfig;
