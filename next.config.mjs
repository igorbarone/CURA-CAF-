const repo = 'CURA-CAF-';
const isPages = process.env.GITHUB_PAGES === 'true';
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  basePath: isPages ? `/${repo}` : '',
  assetPrefix: isPages ? `/${repo}/` : undefined,
};
export default nextConfig;
