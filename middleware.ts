import { Req, Middleware } from "./types.ts";

export interface CorsOptions {
  origin?: string | string[] | ((origin: string) => boolean);
  methods?: string[];
  allowedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

export function cors(options: CorsOptions = {}): Middleware {
  return async (req: Req, next) => {
    if (req.method === "OPTIONS") {
      const headers = new Headers();
      
      if (options.origin) {
        const origin = req.headers.get("origin");
        if (origin) {
          if (typeof options.origin === "function") {
            if (options.origin(origin)) {
              headers.set("Access-Control-Allow-Origin", origin);
            }
          } else if (Array.isArray(options.origin)) {
            if (options.origin.includes(origin)) {
              headers.set("Access-Control-Allow-Origin", origin);
            }
          } else {
            headers.set("Access-Control-Allow-Origin", options.origin);
          }
        }
      }

      if (options.methods) {
        headers.set("Access-Control-Allow-Methods", options.methods.join(", "));
      }

      if (options.allowedHeaders) {
        headers.set("Access-Control-Allow-Headers", options.allowedHeaders.join(", "));
      }

      if (options.credentials) {
        headers.set("Access-Control-Allow-Credentials", "true");
      }

      if (options.maxAge) {
        headers.set("Access-Control-Max-Age", options.maxAge.toString());
      }

      return new Response(null, { headers });
    }

    const response = await next();
    const headers = new Headers(response.headers);

    if (options.origin) {
      const origin = req.headers.get("origin");
      if (origin) {
        if (typeof options.origin === "function") {
          if (options.origin(origin)) {
            headers.set("Access-Control-Allow-Origin", origin);
          }
        } else if (Array.isArray(options.origin)) {
          if (options.origin.includes(origin)) {
            headers.set("Access-Control-Allow-Origin", origin);
          }
        } else {
          headers.set("Access-Control-Allow-Origin", options.origin);
        }
      }
    }

    if (options.credentials) {
      headers.set("Access-Control-Allow-Credentials", "true");
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

export function securityHeaders(): Middleware {
  return async (req: Req, next) => {
    const response = await next();
    const headers = new Headers(response.headers);

    // Add security headers
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Frame-Options", "DENY");
    headers.set("X-XSS-Protection", "1; mode=block");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("Content-Security-Policy", "default-src 'self'");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
}

export function rateLimit(options: RateLimitOptions): Middleware {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return async (req: Req, next) => {
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const now = Date.now();

    const requestData = requests.get(ip);
    if (requestData) {
      if (now > requestData.resetTime) {
        requests.set(ip, { count: 1, resetTime: now + options.windowMs });
      } else if (requestData.count >= options.max) {
        return new Response("Too Many Requests", { status: 429 });
      } else {
        requestData.count++;
      }
    } else {
      requests.set(ip, { count: 1, resetTime: now + options.windowMs });
    }

    return next();
  };
} 