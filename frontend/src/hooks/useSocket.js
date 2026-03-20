import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

// In production this will be the Render backend URL (without /api)
// In development it's localhost:5000
const SOCKET_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace("/api", "")
  : "http://localhost:5000";

export const useSocket = (roomId, username, handlers) => {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!roomId || !username) return;
    socketRef.current = io(SOCKET_URL);
    const socket = socketRef.current;
    socket.emit("join-room", { roomId, username });

    const events = {
      "code-update": handlers.onCodeUpdate,
      "user-joined": handlers.onUserJoined,
      "user-left": handlers.onUserLeft,
      "receive-message": handlers.onMessage,
      "language-update": handlers.onLanguageUpdate,
      "cursor-update": handlers.onCursorUpdate,
      "cursor-remove": handlers.onCursorRemove,
      "selection-update": handlers.onSelectionUpdate,
      "user-typing": handlers.onUserTyping,
      "room-users": handlers.onRoomUsers,
      "execution-result": handlers.onExecutionResult,
    };

    Object.entries(events).forEach(([event, handler]) => {
      if (handler) socket.on(event, handler);
    });

    return () => { socket.disconnect(); };
  }, [roomId, username]);

  const emit = (event, data) => socketRef.current?.emit(event, { roomId, ...data });

  return {
    emitCodeChange: (code) => emit("code-change", { code }),
    emitLanguageChange: (language) => emit("language-change", { language }),
    emitMessage: (username, content) => emit("send-message", { username, content }),
    emitCursorMove: (position) => emit("cursor-move", { position }),
    emitSelectionChange: (selection) => emit("selection-change", { selection }),
    emitTyping: (username, isTyping) => emit("typing", { username, isTyping }),
  };
};
