import { XebecServer } from "./server.ts"; // Adjust the import path as needed
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

  assertEquals(await response.text(), "Not found");
  assertEquals(response.status, 404);
});

Deno.test("XebecServer - POST request", async () => {
  const app = new XebecServer();

  app.POST("/submit", async (req) => {
    const formData = await req.formData();
    const name = formData.get("name");
    return new Response(`Submitted: ${name}`);
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