/**
 * Represents an HTTP request with additional functionality for parameter and query handling.
 * Extends the standard Request class with additional properties for route parameters and query strings.
 */
export class Req extends Request {
  /** Route parameters extracted from the URL pattern */
  params: Record<string, string>;
  /** Query parameters from the URL */
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

/**
 * A handler function that processes an HTTP request and returns a Response.
 * Can be synchronous or asynchronous.
 */
export type Handler = (req: Req) => Promise<Response> | Response;

/**
 * Middleware function that can process requests before they reach route handlers.
 * Can modify the request, response, or terminate the request chain.
 */
export type Middleware = (
  req: Req,
  next: () => Promise<Response> | Response
) => Promise<Response> | Response;

/**
 * Configuration options for the XebecServer
 */
export interface ServerOptions {
  /** Enable detailed request logging */
  debug?: boolean;
  /** Custom error handler for uncaught exceptions */
  errorHandler?: (error: Error, req: Req) => Response | Promise<Response>;
  /** Maximum request body size in bytes */
  maxBodySize?: number;
  /** Default response headers */
  defaultHeaders?: Record<string, string>;
}

/**
 * Route configuration object
 */
export interface RouteConfig {
  /** HTTP method */
  method: string;
  /** URL pattern with optional parameters */
  path: string;
  /** Request handler function */
  handler: Handler;
  /** Optional middleware specific to this route */
  middleware?: Middleware[];
  /** Optional route-specific options */
  options?: {
    /** Whether to parse JSON bodies */
    parseJson?: boolean;
    /** Whether to parse URL-encoded bodies */
    parseUrlEncoded?: boolean;
    /** Custom validation function */
    validate?: (req: Req) => boolean | Promise<boolean>;
  };
}

/**
 * Response helper functions for common HTTP responses
 */
export const ResponseHelper = {
  /** Creates a JSON response */
  json: (data: unknown, status = 200, headers?: Record<string, string>) => {
    const responseHeaders = new Headers(headers);
    responseHeaders.set("Content-Type", "application/json");
    return new Response(JSON.stringify(data), {
      status,
      headers: responseHeaders,
    });
  },

  /** Creates a text response */
  text: (text: string, status = 200, headers?: Record<string, string>) => {
    const responseHeaders = new Headers(headers);
    responseHeaders.set("Content-Type", "text/plain");
    return new Response(text, {
      status,
      headers: responseHeaders,
    });
  },

  /** Creates an error response */
  error: (message: string, status = 500, headers?: Record<string, string>) => {
    return ResponseHelper.json({ error: message }, status, headers);
  },

  /** Creates a redirect response */
  redirect: (url: string, status = 302) => {
    return new Response(null, {
      status,
      headers: { Location: url },
    });
  },
}; 