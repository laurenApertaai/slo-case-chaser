import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // The SLO documents are uploaded by the adviser through a server action on
    // the case forms. The default limit is 1MB, which a scanned pack exceeds.
    serverActions: { bodySizeLimit: "25mb" },
    // The login guard buffers request bodies and silently truncates anything
    // over this limit. Client uploads skip the guard entirely (see proxy.ts);
    // this covers the adviser's SLO upload, which does pass through it.
    proxyClientMaxBodySize: "30mb",
  },
};

export default nextConfig;
