import type { NextConfig } from "next";

/**
 * OAA frontend configuration.
 *
 * Locked Decision 8: the browser never talks to the backend directly. Next.js
 * `rewrites()` proxies every `/api/*` request to the FastAPI gateway on
 * `:8000`, which eliminates CORS entirely and — crucially — keeps SSE streams
 * unbuffered (the backend already sends `Cache-Control: no-cache` and
 * `X-Accel-Buffering: no`).
 */
const nextConfig: NextConfig = {
  /**
   * The compression middleware (Next's `compress` option, on by default) wraps
   * the response in gzip, which buffers the small `text/event-stream` frames
   * until the response ends — that would freeze the whole live War Room
   * (SSE-driven bentos, SLA stopwatch) into a single burst at the end.
   * Compression is therefore disabled: the payload is a localhost control
   * plane and unbuffered SSE is a hard requirement (Locked Decision 8).
   */
  compress: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
