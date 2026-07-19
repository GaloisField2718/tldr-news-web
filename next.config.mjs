/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./.generated/archive-*.json"],
    "/issues/[sector]/[date]": ["./.generated/issues/**/*.json"],
    "/search": ["./.generated/search-metadata.json", "./.generated/search/*.json.gz"],
  },
}

export default nextConfig
