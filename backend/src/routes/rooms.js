const express = require("express");
const router = express.Router();
const { createRoom, joinRoom, getMyRooms, saveCode } = require("../controllers/roomController");
const authMiddleware = require("../middleware/auth");

// All room routes are protected — user must be logged in
router.use(authMiddleware);

router.post("/create", createRoom);
router.post("/join", joinRoom);
router.get("/my-rooms", getMyRooms);
router.post("/:roomId/save", saveCode);

module.exports = router;
