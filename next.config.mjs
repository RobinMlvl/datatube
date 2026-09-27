/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  // DataTube always runs under `next dev` (npm run dev): keep the floating dev badge off the UI.
  devIndicators: false,
};

export default nextConfig;
