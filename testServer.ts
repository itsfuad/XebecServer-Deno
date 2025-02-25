import { Server } from "https://deno.land/x/socket_io@0.2.1/mod.ts";

import { XebecServer } from "./mod.ts";

// Use case
const app = new XebecServer();

// Middleware example
app.use(async (req, next) => {
  console.log(`Incoming request: ${req.url}`);
  const response = await next(); // Proceed to next middleware or route handler
  response.headers.set("X-Served-By", "XebecServer");
  return response;
});

app.GET("/", (_) => {
  return new Response("Hello, Deno Deploy!");
});

app.GET("/dynamic/:name", (req) => {
  const { name } = req.params;
  return new Response(`Hello, ${name}!`);
});

const fileServer = new XebecServer();

fileServer.GET("/nested", (_) => {
  return new Response("Nested route");
});

const MAX_SIZE = 1024 * 1024 * 2; // 2MB

fileServer.POST("/", async (req) => {
  // Check file size before parsing form
  const contentLength = req.headers.get('content-length');

  if (!contentLength) {
    return new Response('No content length found', { status: 400 });
  }

  if (+contentLength > MAX_SIZE) {
    return new Response(`File size should be within ${MAX_SIZE} bytes.`, { status: 400 });
  }

  const form = await req.formData();

  if (!form) {
    return new Response('No form found', { status: 400 });
  }

  // Get the uploaded file(s)
  const files = form.getAll('file') as File[];

  if (!files.length) {
    return new Response('No files found', { status: 400 });
  }

  if (files.length > 1) {
    return new Response('Only one file is allowed', { status: 400 });
  }

  const file = files[0];

  if (file.size > MAX_SIZE) {
    return new Response(`File size should be within ${MAX_SIZE} bytes.`, { status: 400 });
  }

  // Create the uploads directory if it doesn't exist
  const uploadDir = './uploads';
  try {
    await Deno.mkdir(uploadDir, { recursive: true });
    console.log('Upload directory created or already exists');
  } catch (err) {
    console.error('Failed to create upload directory:', err);
    return new Response('Failed to create upload directory', { status: 500 });
  }

  // Write the file to disk
  const filePath = `${uploadDir}/${file.name}`;
  try {
    await Deno.writeFile(filePath, file.stream());
    return new Response('File uploaded successfully');
  } catch (err) {
    console.error('Failed to write file:', err);
    return new Response('Failed to upload file', { status: 500 });
  }
});

// Fix: Correctly route to "/other/nested"
app.route("/files", fileServer);

// Initialize socket.io server
const io = new Server({
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

export const handler = io.handler(async (req: Request) => {
  // Upgrade to WebSocket
  return await app.handler(req) || new Response(null, { status: 404 });
});

Deno.serve({ handler, port: 8080 });
