/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/admin',
  output: 'standalone',
  experimental: {
    optimizePackageImports: ['lucide-react']
  }
};

export default nextConfig;


