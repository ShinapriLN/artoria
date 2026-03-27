import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Allow embedding from HF Spaces
          {
            key: "X-Frame-Options",
            value: "ALLOW-FROM https://shinapri-artoria-zero.hf.space",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://*.hf.space https://huggingface.co",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
