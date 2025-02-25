# Xebec Server

Xebec Server is a lightweight HTTP server featuring routing, middleware, and nested routing capabilities for Deno projects. It supports RESTful route definitions with dynamic parameters and integrates seamlessly with Socket.IO for real-time applications.

![logo](cover.png)

## Use Case

Xebec Server is ideal for building backend applications that require:

- Simple REST API development with dynamic routes (e.g., `/user/:id`)
- Middleware support for logging, authentication, or request modification
- Nested routing to organize large applications by delegating specific paths
- Real-time server capabilities when integrated with Socket.IO

## How to Use It

### Installation

1. Clone the repository and navigate to the project directory.
2. Ensure you have Deno installed.
3. The project uses Deno dependencies such as Socket.IO. No additional setup is needed.

### Routing and Middleware

Define routes and middleware in your server file as follows:

```ts
import { XebecServer } from "./server.ts";

// Initialize the server
const app = new XebecServer();

// Global middleware example: Logging incoming requests
app.use(async (req, next) => {
    console.log(`Incoming request: ${req.url}`);
    const response = await next();
    response.headers.set("X-Served-By", "XebecServer");
    return response;
});

// Define a simple GET route
app.GET("/", (_) => {
    return new Response("Hello, Deno Deploy!");
});

// Dynamic route with parameters
app.GET("/user/:id", (req) => {
    return new Response(`User ID: ${req.params.id}`);
});
```

### Integrating with Socket.IO

Xebec Server can be integrated with Socket.IO to provide WebSocket support. Below is a sample integration:

```ts
import { Server } from "https://deno.land/x/socket_io@0.2.1/mod.ts";
import { XebecServer } from "./server.ts";

// Create Xebec server instance
const app = new XebecServer();

// Define routes and middleware here...
app.GET("/", (_) => {
    return new Response("Hello, with Socket.IO!");
});

// Initialize a Socket.IO server with CORS support
const io = new Server({
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true,
    },
});

// Create a combined request handler for HTTP and WebSocket upgrades
export const handler = io.handler(async (req: Request) => {
    // Upgrade to WebSocket if applicable, otherwise handle HTTP request
    return await app.handler(req) || new Response(null, { status: 404 });
});

// Serve on a designated port
Deno.serve({ handler, port: 8080 });
```

### Running the Server

Run your server using Deno:

```sh
deno run --allow-net --allow-write --allow-read server.ts
```

### Testing

Automated tests are provided in `server.test.ts` to ensure that routes and middleware work as expected. Run tests with:

```sh
deno test --allow-net --allow-write --allow-read
```

## Conclusion

Xebec Server offers a clean and modular approach to building HTTP servers with Deno. With its support for middleware, dynamic routes, nested routing, and Socket.IO integration, it can be adapted for various server-side applications ranging from simple REST APIs to complex real-time systems.
