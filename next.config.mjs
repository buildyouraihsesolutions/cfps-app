/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  experimental: { serverComponentsExternalPackages: ['pdf-lib'] },
};
export default nextConfig;
