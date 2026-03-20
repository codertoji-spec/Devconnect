# DevCollab — Real-time Code Collaboration

A full-stack web application that lets multiple developers write and edit code together in real-time, similar to Google Docs but for code.

## 🚀 Features

- **Real-time code sync** — changes appear instantly for all users in the room
- **Monaco Editor** — same editor as VS Code, with syntax highlighting for 7 languages
- **Room system** — create rooms, share a 6-character code, others join instantly
- **Live presence** — see who's currently in the room
- **In-room chat** — communicate without leaving the editor
- **Code history** — save snapshots of code at any point
- **JWT Auth** — secure login/register system

## 🛠 Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React, Tailwind CSS, Monaco Editor |
| Backend | Node.js, Express |
| Real-time | Socket.io (WebSockets) |
| Database | PostgreSQL |
| Auth | JWT (JSON Web Tokens) |
| Deployment | Docker, Docker Compose |

## 📁 Project Structure

```
devcollab/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js           # PostgreSQL connection pool
│   │   │   └── schema.sql      # Database tables
│   │   ├── middleware/
│   │   │   └── auth.js         # JWT verification middleware
│   │   ├── controllers/
│   │   │   ├── authController.js   # Register, login, getMe
│   │   │   └── roomController.js   # Create, join, save rooms
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   └── rooms.js
│   │   └── index.js            # Express + Socket.io server
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── context/
│   │   │   └── AuthContext.jsx # Global auth state
│   │   ├── hooks/
│   │   │   └── useSocket.js    # Socket.io hook
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Dashboard.jsx   # Room list, create/join
│   │   │   └── Room.jsx        # Editor + chat
│   │   └── App.jsx             # Routes
│   ├── Dockerfile
│   └── package.json
└── docker-compose.yml
```

## ⚡ Running Locally

### Option 1: Docker (Recommended)

```bash
# Clone the repo
git clone https://github.com/yourusername/devcollab
cd devcollab

# Start everything with one command
docker-compose up --build

# App runs at http://localhost
```

### Option 2: Manual Setup

**Prerequisites:** Node.js 18+, PostgreSQL

```bash
# 1. Setup database
psql -U postgres -c "CREATE DATABASE devcollab;"
psql -U postgres -d devcollab -f backend/src/config/schema.sql

# 2. Start backend
cd backend
cp .env.example .env        # Fill in your values
npm install
npm run dev                 # Runs on http://localhost:5000

# 3. Start frontend
cd ../frontend
cp .env.example .env
npm install
npm run dev                 # Runs on http://localhost:5173
```

## 🌐 API Endpoints

### Auth
| Method | Route | Description |
|---|---|---|
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Get current user (protected) |

### Rooms
| Method | Route | Description |
|---|---|---|
| POST | /api/rooms/create | Create a room (protected) |
| POST | /api/rooms/join | Join by room code (protected) |
| GET | /api/rooms/my-rooms | Get user's rooms (protected) |
| POST | /api/rooms/:roomId/save | Save code snapshot (protected) |

## 🔌 Socket Events

| Event | Direction | Description |
|---|---|---|
| join-room | Client → Server | User enters a room |
| code-change | Client → Server | User edits code |
| code-update | Server → Client | Broadcast code to others |
| send-message | Client → Server | User sends chat message |
| receive-message | Server → Client | Broadcast message to room |
| user-joined | Server → Client | Notify room of new user |
| user-left | Server → Client | Notify room user disconnected |

## 🧠 Key Concepts (For Interviews)

**Why Socket.io over plain WebSockets?**
Socket.io adds rooms, auto-reconnect, and fallback to long-polling automatically. Plain WebSockets require you to implement all of this yourself.

**Why PostgreSQL over MongoDB?**
Our data has clear relationships (users → rooms → participants). Relational data + JOIN queries fit PostgreSQL perfectly. MongoDB would add unnecessary complexity here.

**How does real-time sync work?**
When User A types, the frontend emits a `code-change` event to the server. The server uses `socket.to(roomId).emit()` to broadcast to everyone in that room EXCEPT the sender. This avoids the sender seeing their own edits applied twice.

**What is JWT?**
A signed token containing user info. The server signs it with a secret key. The client stores it in localStorage and sends it with every request. The server verifies the signature — no database lookup needed.
