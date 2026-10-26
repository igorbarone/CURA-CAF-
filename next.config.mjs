const repo = "CURA-CAF-";
const isPages = process.env.GITHUB_PAGES === "true";
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  env: { NEXT_PUBLIC_BASE_PATH: isPages ? `/${repo}` : "" },
  images: { unoptimized: true },
  trailingSlash: true,
  basePath: isPages ? `/${repo}` : "",
  assetPrefix: isPages ? `/${repo}/` : undefined,
};
export default nextConfig;
