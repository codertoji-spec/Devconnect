require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const pool = require("./config/db");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(cors({ origin: "*" }));
app.use(express.json());

app.get("/", (req, res) => res.json({ status: "DevCollab API running 🚀" }));

// ─── Judge0 Language ID Map ───────────────────────────────────────────────────
const LANGUAGE_IDS = {
  javascript: 63,
  python:     71,
  java:       62,
  cpp:        54,
  typescript: 74,
  go:         60,
  rust:       73,
};

// Judge0 is running locally on port 2358
// From inside Docker we use host.docker.internal to reach the host machine
const JUDGE0_URL = "http://host.docker.internal:2358";

// ─── Code Execution Route ─────────────────────────────────────────────────────
app.post("/api/execute", async (req, res) => {
  const { code, language, roomId, username } = req.body;

  const languageId = LANGUAGE_IDS[language];
  if (!languageId) {
    return res.status(400).json({ error: `Language "${language}" not supported` });
  }

  try {
    // Step 1: Submit code to local Judge0
    const submitResponse = await fetch(
      `${JUDGE0_URL}/submissions?base64_encoded=false&wait=false`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_code: code,
          language_id: languageId,
          stdin: "",
        }),
      }
    );

    const { token } = await submitResponse.json();
    if (!token) return res.status(500).json({ error: "Failed to submit to Judge0" });

    // Step 2: Poll for result every 1 second
    let result = null;
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 1000));

      const pollResponse = await fetch(
        `${JUDGE0_URL}/submissions/${token}?base64_encoded=false`
      );
      result = await pollResponse.json();

      // Status 1 = In Queue, 2 = Processing, anything else = done
      if (result.status?.id > 2) break;
    }

    const output = {
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      compile_output: result.compile_output || "",
      status: result.status?.description || "Unknown",
      time: result.time,
      memory: result.memory,
      language,
      username,
      ran_at: new Date().toISOString(),
    };

    // Broadcast result to everyone in the room
    if (roomId) io.to(roomId).emit("execution-result", output);

    res.json(output);
  } catch (err) {
    console.error("Execution error:", err);
    res.status(500).json({ error: "Could not reach Judge0. Make sure it's running on port 2358." });
  }
});

// ─── Socket.io ────────────────────────────────────────────────────────────────
const roomUsers = {};
const COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#f97316"];
const getColor = (index) => COLORS[index % COLORS.length];

io.on("connection", (socket) => {
  console.log(`🔌 Connected: ${socket.id}`);

  socket.on("join-room", ({ roomId, username }) => {
    socket.join(roomId);
    if (!roomUsers[roomId]) roomUsers[roomId] = [];
    const color = getColor(roomUsers[roomId].length);
    roomUsers[roomId].push({ socketId: socket.id, username, color });
    socket.emit("room-users", { users: roomUsers[roomId] });
    socket.to(roomId).emit("user-joined", { username, color, users: roomUsers[roomId] });
  });

  socket.on("code-change", ({ roomId, code }) => socket.to(roomId).emit("code-update", { code }));
  socket.on("language-change", ({ roomId, language }) => socket.to(roomId).emit("language-update", { language }));

  socket.on("cursor-move", ({ roomId, position }) => {
    const user = roomUsers[roomId]?.find((u) => u.socketId === socket.id);
    if (user) socket.to(roomId).emit("cursor-update", { socketId: socket.id, username: user.username, color: user.color, position });
  });

  socket.on("selection-change", ({ roomId, selection }) => {
    const user = roomUsers[roomId]?.find((u) => u.socketId === socket.id);
    if (user) socket.to(roomId).emit("selection-update", { socketId: socket.id, username: user.username, color: user.color, selection });
  });

  socket.on("send-message", async ({ roomId, username, content }) => {
    const message = { username, content, sent_at: new Date().toISOString() };
    try { await pool.query("INSERT INTO messages (room_id, username, content) VALUES ($1, $2, $3)", [roomId, username, content]); } catch {}
    io.to(roomId).emit("receive-message", message);
  });

  socket.on("typing", ({ roomId, username, isTyping }) => socket.to(roomId).emit("user-typing", { username, isTyping }));

  socket.on("disconnect", () => {
    for (const roomId in roomUsers) {
      const before = roomUsers[roomId];
      roomUsers[roomId] = before.filter((u) => u.socketId !== socket.id);
      const left = before.find((u) => u.socketId === socket.id);
      if (left) {
        io.to(roomId).emit("cursor-remove", { socketId: socket.id });
        io.to(roomId).emit("user-left", { username: left.username, users: roomUsers[roomId] });
      }
      if (roomUsers[roomId].length === 0) delete roomUsers[roomId];
    }
    console.log(`🔴 Disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
