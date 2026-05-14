/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "sharp"],
    serverActions: { bodySizeLimit: "100mb" },
  },
};

export default nextConfig;
