import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // samodzielny serwer w obrazie Docker (frontend/Dockerfile)
  output: "standalone",
  // strona startowa → panel urzędnika (przed routingiem, bez renderowania strony)
  redirects() {
    return [{ source: "/", destination: "/official", permanent: false }];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
