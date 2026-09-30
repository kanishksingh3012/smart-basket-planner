import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  // Data files read with fs at runtime must be bundled into the server functions explicitly.
  outputFileTracingIncludes: {
    "/api/*": ["src/lib/recipes/mealdb.json", "src/fixtures/*.json"],
  },
};

export default nextConfig;
