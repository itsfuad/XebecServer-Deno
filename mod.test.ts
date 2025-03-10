import { XebecServer } from "./mod.ts"; // Adjust the import path as needed
import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";

// Test the XebecServer class
Deno.test("XebecServer - Basic GET route", async () => {
  const app = new XebecServer();

  app.GET("/", () => {
    return new Response("Hello, World!");
  });

  const request = new Request("http://localhost:8080/");
  const response = await app.handler(request);

  assertEquals(await response.text(), "Hello, World!");
  assertEquals(response.status, 200);
});

Deno.test("XebecServer - Dynamic route with parameters", async () => {
  const app = new XebecServer();

  app.GET("/user/:id", (req) => {
    const { id } = req.params;
    return new Response(`User ID: ${id}`);
  });

  const request = new Request("http://localhost:8080/user/123");
  const response = await app.handler(request);

  assertEquals(await response.text(), "User ID: 123");
  assertEquals(response.status, 200);
});

Deno.test("XebecServer - Query parameters", async () => {
  const app = new XebecServer();

  app.GET("/search", (req) => {
    const { q } = req.query;
    return new Response(`Search query: ${q}`);
  });

  const request = new Request("http://localhost:8080/search?q=deno");
  const response = await app.handler(request);

  assertEquals(await response.text(), "Search query: deno");
  assertEquals(response.status, 200);
});

Deno.test("XebecServer - Middleware", async () => {
  const app = new XebecServer();

  app.use(async (_, next) => {
    const response = await next();
    response.headers.set("X-Middleware", "processed");
    return response;
  });

  app.GET("/middleware", () => {
    return new Response("Middleware test");
  });

  const request = new Request("http://localhost:8080/middleware");
  const response = await app.handler(request);

  assertEquals(await response.text(), "Middleware test");
  assertEquals(response.headers.get("X-Middleware"), "processed");
  assertEquals(response.status, 200);
});

Deno.test("XebecServer - Nested routing", async () => {
  const app = new XebecServer();
  const nestedApp = new XebecServer();

  nestedApp.GET("/nested", () => {
    return new Response("Nested route");
  });

  app.route("/prefix", nestedApp);

  const request = new Request("http://localhost:8080/prefix/nested");
  const response = await app.handler(request);

  assertEquals(await response.text(), "Nested route");
  assertEquals(response.status, 200);
});

Deno.test("XebecServer - 404 Not Found", async () => {
  const app = new XebecServer();

  app.GET("/exists", () => {
    return new Response("This exists");
  });

  const request = new Request("http://localhost:8080/does-not-exist");
  const response = await app.handler(request);

  const body = await response.json();
  assertEquals(body.error, "Not found");
  assertEquals(response.status, 404);
});

Deno.test("XebecServer - POST request", async () => {
  const app = new XebecServer();

  app.POST("/submit", async (req) => {
    const formData = await req.formData();
    const val = formData.get("name");
    if (!val) {
      return new Response("No name provided", { status: 400 });
    }

    if (typeof val !== "string") {
      return new Response("Invalid name", { status: 400 });
    }

    return new Response(`Submitted: ${val}`);
  });

  const formData = new FormData();
  formData.append("name", "Deno");

  const request = new Request("http://localhost:8080/submit", {
    method: "POST",
    body: formData,
  });

  const response = await app.handler(request);

  assertEquals(await response.text(), "Submitted: Deno");
  assertEquals(response.status, 200);
});

Deno.test("XebecServer - * wildcard route", async () => {
  const app = new XebecServer();

  // Register OPTIONS wildcard route
  app.OPTIONS("*", () => {
    return new Response("Wildcard route");
  });

  // Test OPTIONS request for any path
  const request = new Request("http://localhost:8080/anything", {
    method: "OPTIONS",
  });
  const response = await app.handler(request);
  const responseText = await response.text(); // Store before reuse

  assertEquals(responseText, "Wildcard route");
  assertEquals(response.status, 200);

  // Create a secondary handler
  const otherHandler = new XebecServer();
  otherHandler.GET("/specificPath", () => {
    return new Response("Specific route");
  });

  // Mount it under /specific
  app.route("/specific", otherHandler);

  // Send an OPTIONS request to a nested route
  const otherRequest = new Request("http://localhost:8080/specific/specificPath", {
    method: "OPTIONS",
  });
  const otherResponse = await app.handler(otherRequest);
  const otherResponseText = await otherResponse.text(); // Store before reuse

  console.log(otherResponseText);

  assertEquals(otherResponseText, "Wildcard route");
  assertEquals(otherResponse.status, 200);
});