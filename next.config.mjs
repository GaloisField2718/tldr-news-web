/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./.generated/archive-*.json"],
    "/issues/[sector]/[date]": ["./.generated/issues/**/*.json"],
    "/search": ["./.generated/search-metadata.json", "./.generated/search/*.json.gz"],
    "/daily": ["./.generated/daily-metadata.json"],
    "/daily/**": [
      "./.generated/daily-metadata.json",
      "./.generated/daily/*.json.gz",
      "./.generated/editorial/**/*.json",
    ],
  },
}

export default nextConfig
