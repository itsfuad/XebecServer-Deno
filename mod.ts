
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
 * const server = new XebecServer();
 *
 * // Add middleware
 * server.use((req, next) => {
 *   console.log("Request URL:", req.url);
 *   return next();
 * });
 *
 * // Define a GET route with a dynamic parameter
 * server.GET("/user/:id", (req) => {
 *   return new Response(`User ID: ${req.params.id}`);
 * });
 *
 * // Mount a nested server on a URL prefix
 * const adminServer = new XebecServer();
 * adminServer.GET("/dashboard", (req) => new Response("Admin Dashboard"));
 * server.route("/admin", adminServer);
 */

export class Req extends Request {
  params: Record<string, string>;
  query: Record<string, string>;

  constructor(
    input: RequestInfo,
    init?: RequestInit,
    params: Record<string, string> = {},
    query: Record<string, string> = {},
  ) {
    super(input, init);
    this.params = params;
    this.query = query;
  }
}

export type Handler = (req: Req) => Promise<Response> | Response;

export type Middleware = (req: Req, next: () => Promise<Response> | Response) => Promise<Response> | Response;

export class XebecServer {
  private routes: {
    [method: string]: Array<{
      pattern: string;
      regex: RegExp;
      paramNames: string[];
      handler: Handler;
      isWildcard: boolean;
    }>;
  } = {};

  private readonly middlewares: Middleware[] = [];
  private wildcardRoutes: { [method: string]: Handler | null } = {};

  // Middleware
  use(middleware: Middleware) {
    this.middlewares.push(middleware);
  }

  // Route definition methods
  GET(path: string, callback: Handler) {
    this.addRoute("GET", path, callback);
  }

  POST(path: string, callback: Handler) {
    this.addRoute("POST", path, callback);
  }

  OPTIONS(path: string, callback: Handler) {
    this.addRoute("OPTIONS", path, callback);
  }

  PUT(path: string, callback: Handler) {
    this.addRoute("PUT", path, callback);
  }

  DELETE(path: string, callback: Handler) {
    this.addRoute("DELETE", path, callback);
  }

  PATCH(path: string, callback: Handler) {
    this.addRoute("PATCH", path, callback);
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
  
        const response = await instance.handler(newReq);
  
        // If the child server returns 404, allow the parent to handle it
        if (response.status !== 404) {
          return response;
        }
      }
  
      return next();
    });
  }  

  private addRoute(method: string, path: string, handler: Handler) {
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
      });
    }
  }

  handler(req: Request) {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const method = req.method.toUpperCase();
    const routesForMethod = this.routes[method] || [];

    const clonedReq = new Req(req, req.clone(), {}, {});

    let index = 0;
    const next = (): Promise<Response> | Response => {
      if (index < this.middlewares.length) {
        return this.middlewares[index++](clonedReq, next);
      }

      let matchedHandler: Handler | null = null;
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
          break;
        }
      }

      if (!matchedHandler && this.wildcardRoutes[method]) {
        matchedHandler = this.wildcardRoutes[method];
      }

      if (matchedHandler) {
        clonedReq.params = matchedParams;
        clonedReq.query = matchedQuery;
        return matchedHandler(clonedReq);
      }

      return new Response("Not found", { status: 404 });
    };

    return next();
  }
}
