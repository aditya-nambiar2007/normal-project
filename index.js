const express = require("express");
const path = require("path");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

let action = "Waiting...";

// Middleware for CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Support text, json, and urlencoded payloads
app.use(express.text({ type: ["text/plain", "text/*"] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  if (req.url !== "/action" || req.method !== "GET") {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`, req.body || "");
  }
  next();
});

// Serve static assets from public if present, and current directory
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(__dirname));

// Serve index.html at root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"), (err) => {
    if (err) {
      res.sendFile(path.join(__dirname, "index.html"));
    }
  });
});

// Endpoint to retrieve current action (useful for polling & serverless)
app.get("/action", (req, res) => {
  res.json({ action });
});

// Endpoint to set current action (used by ESP32 or client)
app.post("/action", (req, res) => {
  let receivedAction = "";

  if (typeof req.body === "string") {
    receivedAction = req.body.trim();
  } else if (req.body && typeof req.body === "object" && req.body.action) {
    receivedAction = String(req.body.action).trim();
  }

  if (receivedAction) {
    action = receivedAction;
  }

  // Broadcast to connected web clients (local WebSocket mode)
  try {
    io.emit("action", action);
  } catch (err) {
    // Graceful fallback if serverless environment doesn't have active sockets
  }

  res.send("OK");
});

// WebSocket connection handling for local development
io.on("connection", (socket) => {
  socket.emit("action", action);
});

// If executed directly (e.g. `npm start` or `node index.js`), start listening
const PORT = process.env.PORT || 8000;
if (require.main === module) {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on port ${PORT} (http://localhost:${PORT})`);
  });
}

// Export express app for Vercel serverless deployment
module.exports = app;
