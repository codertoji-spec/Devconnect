import { useState } from "react";
import { useNavigate } from "react-router-dom";

const LANGUAGES = ["javascript", "python", "java", "cpp", "typescript", "go", "rust"];

const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

export default function Dashboard() {
  const navigate = useNavigate();
  const [username, setUsername] = useState(localStorage.getItem("username") || "");
  const [roomName, setRoomName] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [joinCode, setJoinCode] = useState("");
  const [tab, setTab] = useState("create");
  const [error, setError] = useState("");

  const saveUsername = () => {
    if (!username.trim()) return false;
    localStorage.setItem("username", username.trim());
    return true;
  };

  const handleCreate = () => {
    setError("");
    if (!username.trim()) return setError("Enter your name first");
    if (!roomName.trim()) return setError("Enter a room name");
    saveUsername();
    const code = generateCode();
    const rooms = JSON.parse(localStorage.getItem("rooms") || "[]");
    rooms.unshift({ id: code, name: roomName, language, room_code: code });
    localStorage.setItem("rooms", JSON.stringify(rooms));
    navigate(`/room/${code}?lang=${language}&name=${encodeURIComponent(roomName)}`);
  };

  const handleJoin = () => {
    setError("");
    if (!username.trim()) return setError("Enter your name first");
    if (!joinCode.trim()) return setError("Enter a room code");
    saveUsername();
    navigate(`/room/${joinCode.toUpperCase()}`);
  };

  const recentRooms = JSON.parse(localStorage.getItem("rooms") || "[]");

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-4">
        <h1 className="text-xl font-bold">Dev<span className="text-blue-500">Collab</span></h1>
      </nav>

      <div className="max-w-lg mx-auto px-6 py-12">
        <div className="mb-8">
          <label className="block text-sm text-gray-400 mb-2">Your Name</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your name..."
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        <div className="flex bg-gray-900 rounded-xl p-1 mb-6">
          <button onClick={() => setTab("create")} className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${tab === "create" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}>Create Room</button>
          <button onClick={() => setTab("join")} className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${tab === "join" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}>Join Room</button>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

        {tab === "create" && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Room Name</label>
              <input value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="e.g. DSA Practice" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Language</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none">
                {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <button onClick={handleCreate} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg py-2.5 text-sm transition">Create Room →</button>
          </div>
        )}

        {tab === "join" && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Room Code</label>
              <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="e.g. XK92PL" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition uppercase tracking-widest" />
            </div>
            <button onClick={handleJoin} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg py-2.5 text-sm transition">Join Room →</button>
          </div>
        )}

        {recentRooms.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm text-gray-400 mb-3">Recent Rooms</h3>
            <div className="space-y-2">
              {recentRooms.slice(0, 5).map((room) => (
                <div key={room.id} onClick={() => { if (!username.trim()) return setError("Enter your name first"); saveUsername(); navigate(`/room/${room.room_code}`); }} className="flex items-center justify-between bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-lg px-4 py-3 cursor-pointer transition">
                  <span className="text-sm">{room.name}</span>
                  <span className="text-xs font-mono text-gray-400 bg-gray-800 px-2 py-1 rounded">{room.room_code}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
