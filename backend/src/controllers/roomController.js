const pool = require("../config/db");

// Generate a random 6-character room code like "XK92PL"
const generateRoomCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// CREATE ROOM: Creates a new coding room
const createRoom = async (req, res) => {
  const { name, language = "javascript" } = req.body;
  const userId = req.user.id;

  if (!name) {
    return res.status(400).json({ error: "Room name is required" });
  }

  try {
    // Generate unique room code, retry if collision
    let room_code;
    let isUnique = false;

    while (!isUnique) {
      room_code = generateRoomCode();
      const existing = await pool.query(
        "SELECT id FROM rooms WHERE room_code = $1",
        [room_code]
      );
      if (existing.rows.length === 0) isUnique = true;
    }

    // Create the room
    const result = await pool.query(
      `INSERT INTO rooms (name, room_code, language, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, room_code, language, userId]
    );

    const room = result.rows[0];

    // Auto-add creator as a participant
    await pool.query(
      "INSERT INTO room_participants (room_id, user_id) VALUES ($1, $2)",
      [room.id, userId]
    );

    // Save initial empty code snapshot
    await pool.query(
      "INSERT INTO code_snapshots (room_id, code, saved_by) VALUES ($1, $2, $3)",
      [room.id, "// Start coding here...", userId]
    );

    res.status(201).json({ room });
  } catch (err) {
    console.error("Create room error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// JOIN ROOM: Join an existing room using room code
const joinRoom = async (req, res) => {
  const { room_code } = req.body;
  const userId = req.user.id;

  if (!room_code) {
    return res.status(400).json({ error: "Room code is required" });
  }

  try {
    // Find room by code
    const roomResult = await pool.query(
      "SELECT * FROM rooms WHERE room_code = $1",
      [room_code.toUpperCase()]
    );

    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }

    const room = roomResult.rows[0];

    // Add user as participant (ON CONFLICT DO NOTHING = ignore if already joined)
    await pool.query(
      `INSERT INTO room_participants (room_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (room_id, user_id) DO NOTHING`,
      [room.id, userId]
    );

    // Get latest code snapshot for this room
    const snapshot = await pool.query(
      `SELECT code FROM code_snapshots
       WHERE room_id = $1
       ORDER BY saved_at DESC LIMIT 1`,
      [room.id]
    );

    res.json({
      room,
      code: snapshot.rows[0]?.code || "",
    });
  } catch (err) {
    console.error("Join room error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// GET MY ROOMS: Fetch all rooms the user has joined or created
const getMyRooms = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT r.*, u.username as creator_name
       FROM rooms r
       JOIN room_participants rp ON r.id = rp.room_id
       LEFT JOIN users u ON r.created_by = u.id
       WHERE rp.user_id = $1
       ORDER BY rp.joined_at DESC`,
      [userId]
    );

    res.json({ rooms: result.rows });
  } catch (err) {
    console.error("Get rooms error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// SAVE CODE: Save current code as a snapshot
const saveCode = async (req, res) => {
  const { roomId } = req.params;
  const { code } = req.body;
  const userId = req.user.id;

  try {
    await pool.query(
      "INSERT INTO code_snapshots (room_id, code, saved_by) VALUES ($1, $2, $3)",
      [roomId, code, userId]
    );

    res.json({ message: "Code saved successfully" });
  } catch (err) {
    console.error("Save code error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { createRoom, joinRoom, getMyRooms, saveCode };
