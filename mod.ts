import { Req, Handler, Middleware, ServerOptions, RouteConfig, ResponseHelper } from "./types.ts";

/**
 * Represents a lightweight HTTP server with built-in routing and middleware support.
 *
 * The XebecServer class allows you to define RESTful routes (GET, POST, OPTIONS, PUT, DELETE, PATCH)
 * with dynamic URL parameters, and process incoming requests through middleware functions before
 * dispatching them to the appropriate route handler.
 *
 * @remarks
 * - URL patterns can include dynamic segments defined with a colon (e.g., "/user/:id"), which will be
 *   extracted into the request parameters.
 * - Middleware functions are executed in the order they are added via the `use()` method, and can intercept,
 *   modify, or handle requests before they reach any matching route.
 * - The `route()` method allows nesting a separate XebecServer instance under a specified URL prefix.
 * - Incoming requests are converted to an internal `Req` object, allowing for cloned (immutable) requests,
 *   parameter extraction, and query parsing.
 *
 * @example
 * ```typescript
 * const server = new XebecServer({
 *   debug: true,
 *   maxBodySize: 1024 * 1024, // 1MB
 *   defaultHeaders: {
 *     "X-Powered-By": "Xebec"
 *   }
 * });
 *
 * // Add middleware
 * server.use((req, next) => {
 *   console.log("Request URL:", req.url);
 *   return next();
 * });
 *
 * // Define a GET route with a dynamic parameter
 * server.GET("/user/:id", (req) => {
 *   return ResponseHelper.json({ id: req.params.id });
 * });
 *
 * // Mount a nested server on a URL prefix
 * const adminServer = new XebecServer();
 * adminServer.GET("/dashboard", (req) => ResponseHelper.text("Admin Dashboard"));
 * server.route("/admin", adminServer);
 * ```
 */
export class XebecServer {
  private routes: {
    [method: string]: Array<{
      pattern: string;
      regex: RegExp;
      paramNames: string[];
      handler: Handler;
      isWildcard: boolean;
      middleware?: Middleware[];
      options?: RouteConfig["options"];
    }>;
  } = {};

  private readonly middlewares: Middleware[] = [];
  private wildcardRoutes: { [method: string]: Handler | null } = {};
  private readonly options: ServerOptions;

  constructor(options: ServerOptions = {}) {
    this.options = {
      debug: false,
      maxBodySize: 1024 * 1024, // 1MB default
      ...options,
    };
  }

  // Middleware
  use(middleware: Middleware) {
    this.middlewares.push(middleware);
  }

  // Route definition methods
  GET(path: string, callback: Handler, config?: Omit<RouteConfig, "method" | "path" | "handler">) {
    this.addRoute("GET", path, callback, config);
  }

  POST(path: string, callback: Handler, config?: Omit<RouteConfig, "method" | "path" | "handler">) {
    this.addRoute("POST", path, callback, config);
  }

  OPTIONS(path: string, callback: Handler, config?: Omit<RouteConfig, "method" | "path" | "handler">) {
    this.addRoute("OPTIONS", path, callback, config);
  }

  PUT(path: string, callback: Handler, config?: Omit<RouteConfig, "method" | "path" | "handler">) {
    this.addRoute("PUT", path, callback, config);
  }

  DELETE(path: string, callback: Handler, config?: Omit<RouteConfig, "method" | "path" | "handler">) {
    this.addRoute("DELETE", path, callback, config);
  }

  PATCH(path: string, callback: Handler, config?: Omit<RouteConfig, "method" | "path" | "handler">) {
    this.addRoute("PATCH", path, callback, config);
  }

  route(prefix: string, instance: XebecServer) {
    if (!prefix.startsWith("/")) {
      prefix = "/" + prefix;
    }

    this.use(async (req, next) => {
      const url = new URL(req.url);
      const pathname = url.pathname;

      if (pathname.startsWith(prefix)) {
        const newPathname = pathname.slice(prefix.length) || "/";
        const newUrl = new URL(newPathname + url.search, url.origin);
        const newReq = new Req(
          new Request(newUrl.toString(), req),
          req.clone(),
          req.params,
          req.query
        );

        try {
          const response = await instance.handler(newReq);
          if (response.status !== 404) {
            return response;
          }
        } catch (error) {
          if (instance.options.errorHandler) {
            return instance.options.errorHandler(error as Error, newReq);
          }
          throw error;
        }
      }

      return next();
    });
  }

  private addRoute(
    method: string,
    path: string,
    handler: Handler,
    config?: Omit<RouteConfig, "method" | "path" | "handler">
  ) {
    const paramNames: string[] = [];
    const isWildcard = path === "*";

    let regexPattern = path.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    regexPattern = regexPattern.replace(/:\w+/g, (param) => {
      paramNames.push(param.slice(1));
      return "([^\\/]+)";
    });

    const regex = new RegExp(`^${regexPattern.replace(/\*/g, ".*")}$`);

    if (!this.routes[method]) {
      this.routes[method] = [];
    }

    if (isWildcard) {
      this.wildcardRoutes[method] = handler;
    } else {
      this.routes[method].push({
        pattern: path,
        regex,
        paramNames,
        handler,
        isWildcard,
        middleware: config?.middleware,
        options: config?.options,
      });
    }
  }

  async handler(req: Request) {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const method = req.method.toUpperCase();
    const routesForMethod = this.routes[method] || [];

    // Check body size
    const contentLength = parseInt(req.headers.get("content-length") || "0");
    if (contentLength > this.options.maxBodySize!) {
      return ResponseHelper.error("Request entity too large", 413);
    }

    const clonedReq = new Req(req, req.clone(), {}, {});

    let index = 0;
    const next = async (): Promise<Response> => {
      if (index < this.middlewares.length) {
        return this.middlewares[index++](clonedReq, next);
      }

      let matchedHandler: Handler | null = null;
      let matchedRoute: typeof routesForMethod[0] | null = null;
      const matchedParams: Record<string, string> = {};
      const matchedQuery: Record<string, string> = {};

      for (const route of routesForMethod) {
        const match = route.regex.exec(pathname);
        if (match) {
          route.paramNames.forEach((name, index) => {
            matchedParams[name] = match[index + 1];
          });

          const searchParams = new URLSearchParams(url.search);
          searchParams.forEach((value, key) => {
            matchedQuery[key] = value;
          });

          matchedHandler = route.handler;
          matchedRoute = route;
          break;
        }
      }

      if (!matchedHandler && this.wildcardRoutes[method]) {
        matchedHandler = this.wildcardRoutes[method];
      }

      if (matchedHandler) {
        try {
          clonedReq.params = matchedParams;
          clonedReq.query = matchedQuery;

          // Apply route-specific middleware
          if (matchedRoute?.middleware) {
            for (const middleware of matchedRoute.middleware) {
              const response = await middleware(clonedReq, () => matchedHandler!(clonedReq));
              if (response) return response;
            }
          }

          // Apply route-specific options
          if (matchedRoute?.options) {
            if (matchedRoute.options.parseJson && req.headers.get("content-type")?.includes("application/json")) {
              const body = await req.json();
              (clonedReq as any).body = body;
            }
            if (matchedRoute.options.parseUrlEncoded && req.headers.get("content-type")?.includes("application/x-www-form-urlencoded")) {
              const body = await req.formData();
              (clonedReq as any).body = Object.fromEntries(body);
            }
            if (matchedRoute.options.validate) {
              const isValid = await matchedRoute.options.validate(clonedReq);
              if (!isValid) {
                return ResponseHelper.error("Validation failed", 400);
              }
            }
          }

          return matchedHandler(clonedReq);
        } catch (error) {
          if (this.options.errorHandler) {
            return this.options.errorHandler(error as Error, clonedReq);
          }
          throw error;
        }
      }

      return ResponseHelper.error("Not found", 404);
    };

    try {
      return await next();
    } catch (error) {
      if (this.options.errorHandler) {
        return this.options.errorHandler(error as Error, clonedReq);
      }
      return ResponseHelper.error("Internal Server Error", 500);
    }
  }
}
