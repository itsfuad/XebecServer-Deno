
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

class Req extends Request {
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

type Handler = (req: Req) => Promise<Response> | Response;

type Middleware = (req: Req, next: () => Promise<Response> | Response) => Promise<Response> | Response;

export class XebecServer {
  private routes: {
    [method: string]: Array<{
      pattern: string;
      regex: RegExp;
      paramNames: string[];
      handler: Handler;
    }>;
  } = {};

  private readonly middlewares: Middleware[] = [];

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
    // Ensure the prefix starts with a slash
    if (!prefix.startsWith("/")) {
      prefix = "/" + prefix;
    }

    // Add a middleware to handle the routing
    this.use((req, next) => {
      const url = new URL(req.url);
      const pathname = url.pathname;

      // Check if the request path starts with the prefix
      if (pathname.startsWith(prefix)) {
        // Adjust the pathname by removing the prefix
        const newPathname = pathname.slice(prefix.length) || "/";
        const newUrl = new URL(newPathname + url.search, url.origin);

        // Create a new request with the adjusted URL
        const newReq = new Req(
          new Request(newUrl.toString(), req),
          req.clone(),
          req.params,
          req.query
        );

        // Handle the request with the nested server instance
        return instance.handler(newReq);
      }

      // If the prefix doesn't match, proceed to the next middleware or route handler
      return next();
    });
  }

  private addRoute(method: string, path: string, handler: Handler) {
    const paramNames: string[] = [];
    const escapedPath = path.replace(/[.+*?^${}()|[\]\\]/g, "\\$&");
    const regexPattern = escapedPath.replace(/:\w+/g, (param) => {
      paramNames.push(param.slice(1));
      return "([^\\/]+)";
    });
    const regex = new RegExp(`^${regexPattern}$`);

    if (!this.routes[method]) {
      this.routes[method] = [];
    }
    this.routes[method].push({
      pattern: path,
      regex,
      paramNames,
      handler,
    });
  }

  handler(req: Request) {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const method = req.method.toUpperCase();
    const routesForMethod = this.routes[method] || [];

    // Convert Request to Req
    const clonedReq = new Req(req, req.clone(), {}, {});
    // Apply middleware
    let index = 0;
    const next = () => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        return middleware(clonedReq, next);
      }

      // Matching route handling
      for (const route of routesForMethod) {
        const match = route.regex.exec(pathname);
        if (match) {
          const params: Record<string, string> = {};
          route.paramNames.forEach((name, index) => {
            params[name] = match[index + 1];
          });

          const query: Record<string, string> = {};
          url.searchParams.forEach((value, key) => {
            query[key] = value;
          });

          clonedReq.params = params;
          clonedReq.query = query;

          return route.handler(clonedReq);
        }
      }

      return new Response("Not found", { status: 404 });
    };

    return next(); // Start middleware chain
  }
}