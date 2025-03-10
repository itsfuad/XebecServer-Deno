# Xebec Server

A lightweight, modern HTTP server for Deno with built-in routing, middleware support, and TypeScript integration.

## Features

- 🚀 Lightweight and fast
- 🔒 Built-in security features (CORS, rate limiting, security headers)
- 🎯 TypeScript support with full type safety
- 🔄 Middleware support
- 🛣️ Dynamic routing with URL parameters
- 📝 Comprehensive documentation
- 🧪 Easy to test and extend

## Installation

```bash
deno add xebec-server
```

## Quick Start

```typescript
import { XebecServer, cors, securityHeaders, rateLimit } from "xebec-server";

const server = new XebecServer({
  debug: true,
  maxBodySize: 1024 * 1024, // 1MB
  defaultHeaders: {
    "X-Powered-By": "Xebec"
  }
});

// Add global middleware
server.use(cors({
  origin: "https://example.com",
  methods: ["GET", "POST"],
  credentials: true
}));
server.use(securityHeaders());
server.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Define routes
server.GET("/", (req) => ResponseHelper.text("Hello World!"));

server.GET("/user/:id", (req) => {
  return ResponseHelper.json({ id: req.params.id });
});

server.POST("/api/data", async (req) => {
  const data = await req.json();
  return ResponseHelper.json({ success: true, data });
}, {
  options: {
    parseJson: true,
    validate: (req) => {
      // Add custom validation
      return true;
    }
  }
});

// Start the server
await server.listen({ port: 8000 });
```

## API Documentation

### XebecServer

The main server class that handles routing and middleware.

#### Constructor Options

```typescript
interface ServerOptions {
  debug?: boolean;           // Enable detailed request logging
  maxBodySize?: number;      // Maximum request body size in bytes
  defaultHeaders?: Record<string, string>;  // Default response headers
  errorHandler?: (error: Error, req: Req) => Response | Promise<Response>;  // Custom error handler
}
```

#### Methods

- `use(middleware: Middleware)`: Add global middleware
- `GET(path: string, handler: Handler, config?: RouteConfig)`: Define a GET route
- `POST(path: string, handler: Handler, config?: RouteConfig)`: Define a POST route
- `PUT(path: string, handler: Handler, config?: RouteConfig)`: Define a PUT route
- `DELETE(path: string, handler: Handler, config?: RouteConfig)`: Define a DELETE route
- `PATCH(path: string, handler: Handler, config?: RouteConfig)`: Define a PATCH route
- `OPTIONS(path: string, handler: Handler, config?: RouteConfig)`: Define an OPTIONS route
- `route(prefix: string, instance: XebecServer)`: Mount a nested server instance

### Middleware

Built-in middleware functions for common use cases:

- `cors(options: CorsOptions)`: Handle Cross-Origin Resource Sharing
- `securityHeaders()`: Add security-related response headers
- `rateLimit(options: RateLimitOptions)`: Implement rate limiting

### ResponseHelper

Helper functions for creating common response types:

- `json(data: unknown, status?: number, headers?: Record<string, string>)`: Create JSON response
- `text(text: string, status?: number, headers?: Record<string, string>)`: Create text response
- `error(message: string, status?: number, headers?: Record<string, string>)`: Create error response
- `redirect(url: string, status?: number)`: Create redirect response

## Security Considerations

- Always use HTTPS in production
- Implement proper authentication and authorization
- Validate and sanitize all user input
- Use rate limiting to prevent abuse
- Keep dependencies up to date
- Follow security best practices for your use case

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details