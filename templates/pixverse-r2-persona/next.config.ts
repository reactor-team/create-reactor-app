import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // StrictMode mounts every provider twice in development. ReactorProvider
  // in @reactor-team/js-sdk 3.4.0 disposes its first client on that extra
  // mount and later calls disconnect() on the disposed one, which throws
  // "This Reactor was disposed" on every page load. Production renders once
  // either way. Turn this back on once the SDK handles the double mount.
  reactStrictMode: false,
};

export default nextConfig;
