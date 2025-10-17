/** @type {import('next').NextConfig} */
const nextConfig = {
  // Re-enable strict checks for production builds
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

module.exports = nextConfig;
