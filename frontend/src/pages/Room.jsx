import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { useSocket } from "../hooks/useSocket";

const LANGUAGES = ["javascript", "python", "java", "cpp", "typescript", "go", "rust"];
const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Status color for execution result badge
const statusColor = (status) => {
  if (!status) return "text-gray-400";
  if (status.toLowerCase().includes("accepted")) return "text-green-400";
  if (status.toLowerCase().includes("error") || status.toLowerCase().includes("wrong")) return "text-red-400";
  if (status.toLowerCase().includes("time")) return "text-yellow-400";
  return "text-blue-400";
};

export default function Room() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const username = localStorage.getItem("username") || "Anonymous";
  const roomName = searchParams.get("name") || roomId;
  const initialLang = searchParams.get("lang") || "javascript";

  const [code, setCode] = useState("// Start coding here...\n");
  const [language, setLanguage] = useState(initialLang);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [showChat, setShowChat] = useState(true);
  const [copied, setCopied] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);

  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState(null);       // Last execution result
  const [showOutput, setShowOutput] = useState(false);
  const [outputHeight, setOutputHeight] = useState(200);

  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationsRef = useRef({});
  const messagesEndRef = useRef(null);
  const isRemoteUpdate = useRef(false);
  const typingTimerRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ─── Cursor Rendering ─────────────────────────────────────────────────────
  const renderCursor = useCallback((socketId, username, color, position) => {
    if (!editorRef.current || !monacoRef.current) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    if (decorationsRef.current[socketId]) {
      editor.deltaDecorations(decorationsRef.current[socketId], []);
    }

    const styleId = `cursor-style-${socketId}`;
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.innerHTML = `
        .remote-cursor-before-${socketId}::before {
          content: '${username}';
          background: ${color};
          color: white;
          font-size: 10px;
          padding: 1px 4px;
          border-radius: 3px;
          position: absolute;
          top: -18px;
          white-space: nowrap;
          font-family: sans-serif;
          z-index: 100;
          pointer-events: none;
        }
        .remote-cursor-${socketId} {
          border-left: 2px solid ${color};
          margin-left: -1px;
        }
      `;
      document.head.appendChild(style);
    }

    const newDecorations = editor.deltaDecorations([], [{
      range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
      options: {
        className: `remote-cursor-${socketId}`,
        beforeContentClassName: `remote-cursor-before-${socketId}`,
        stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
      },
    }]);
    decorationsRef.current[socketId] = newDecorations;
  }, []);

  const renderSelection = useCallback((socketId, color, selection) => {
    if (!editorRef.current || !monacoRef.current) return;
    if (!selection || (selection.startLineNumber === selection.endLineNumber && selection.startColumn === selection.endColumn)) return;

    const editor = editorRef.current;
    const monaco = monacoRef.current;

    const styleId = `selection-style-${socketId}`;
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.innerHTML = `.remote-selection-${socketId} { background: ${color}33; border: 1px solid ${color}88; }`;
      document.head.appendChild(style);
    }

    const existing = decorationsRef.current[`${socketId}-sel`] || [];
    decorationsRef.current[`${socketId}-sel`] = editor.deltaDecorations(existing, [{
      range: new monaco.Range(selection.startLineNumber, selection.startColumn, selection.endLineNumber, selection.endColumn),
      options: { className: `remote-selection-${socketId}` },
    }]);
  }, []);

  const removeCursor = useCallback((socketId) => {
    if (!editorRef.current) return;
    if (decorationsRef.current[socketId]) {
      editorRef.current.deltaDecorations(decorationsRef.current[socketId], []);
      delete decorationsRef.current[socketId];
    }
    if (decorationsRef.current[`${socketId}-sel`]) {
      editorRef.current.deltaDecorations(decorationsRef.current[`${socketId}-sel`], []);
      delete decorationsRef.current[`${socketId}-sel`];
    }
    document.getElementById(`cursor-style-${socketId}`)?.remove();
    document.getElementById(`selection-style-${socketId}`)?.remove();
  }, []);

  // ─── Socket ───────────────────────────────────────────────────────────────
  const { emitCodeChange, emitLanguageChange, emitMessage, emitCursorMove, emitSelectionChange, emitTyping } = useSocket(
    roomId, username,
    {
      onRoomUsers: ({ users }) => setUsers(users),
      onCodeUpdate: ({ code: newCode }) => { isRemoteUpdate.current = true; setCode(newCode); },
      onUserJoined: ({ username: u, users }) => { setUsers(users); setMessages((p) => [...p, { system: true, content: `${u} joined` }]); },
      onUserLeft: ({ username: u, users }) => { setUsers(users); setMessages((p) => [...p, { system: true, content: `${u} left` }]); },
      onMessage: (msg) => setMessages((p) => [...p, msg]),
      onLanguageUpdate: ({ language }) => setLanguage(language),
      onCursorUpdate: ({ socketId, username, color, position }) => renderCursor(socketId, username, color, position),
      onSelectionUpdate: ({ socketId, color, selection }) => renderSelection(socketId, color, selection),
      onCursorRemove: ({ socketId }) => { removeCursor(socketId); setTypingUsers((p) => p.filter((u) => u !== socketId)); },
      onUserTyping: ({ username, isTyping }) => setTypingUsers((p) => isTyping ? [...new Set([...p, username])] : p.filter((u) => u !== username)),
      // When someone runs code, show result to everyone in room
      onExecutionResult: (result) => {
        setOutput(result);
        setShowOutput(true);
        setIsRunning(false);
      },
    }
  );

  // ─── Code Execution ───────────────────────────────────────────────────────
  const handleRun = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setShowOutput(true);
    setOutput(null); // Clear previous output

    try {
      const res = await fetch(`${API}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language, roomId, username }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Result is broadcast via socket to all users including sender
      // So we don't need to setOutput here — onExecutionResult handles it
    } catch (err) {
      setOutput({ stderr: err.message, status: "Error" });
      setIsRunning(false);
    }
  };

  // ─── Editor ───────────────────────────────────────────────────────────────
  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.onDidChangeCursorPosition((e) => emitCursorMove({ lineNumber: e.position.lineNumber, column: e.position.column }));
    editor.onDidChangeCursorSelection((e) => {
      const sel = e.selection;
      emitSelectionChange({ startLineNumber: sel.startLineNumber, startColumn: sel.startColumn, endLineNumber: sel.endLineNumber, endColumn: sel.endColumn });
    });
  };

  const handleCodeChange = (newCode) => {
    if (isRemoteUpdate.current) { isRemoteUpdate.current = false; return; }
    setCode(newCode);
    emitCodeChange(newCode);
  };

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    emitLanguageChange(newLang);
  };

  const handleMessageInput = (e) => {
    setMessageInput(e.target.value);
    emitTyping(username, true);
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => emitTyping(username, false), 1500);
  };

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    emitMessage(username, messageInput);
    emitTyping(username, false);
    setMessageInput("");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── Output panel output text ─────────────────────────────────────────────
  const outputText = output
    ? (output.stdout || "") + (output.stderr ? `\nSTDERR:\n${output.stderr}` : "") + (output.compile_output ? `\nCOMPILE ERROR:\n${output.compile_output}` : "")
    : "";

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col">
      {/* Topbar */}
      <div className="border-b border-gray-800 px-4 py-2.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/")} className="text-gray-400 hover:text-white text-sm transition">← Back</button>
          <span className="font-semibold">{decodeURIComponent(roomName)}</span>
          <button onClick={handleCopy} className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded font-mono transition">
            {copied ? "Copied! ✓" : `🔗 ${roomId}`}
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* User avatars */}
          <div className="flex items-center gap-1">
            {users.length > 0 ? users.slice(0, 5).map((u, i) => (
              <div key={i} className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: u.color }} title={u.username}>
                {u.username?.[0]?.toUpperCase()}
              </div>
            )) : (
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">{username[0]?.toUpperCase()}</div>
            )}
          </div>

          <select value={language} onChange={(e) => handleLanguageChange(e.target.value)} className="bg-gray-800 border border-gray-700 text-sm rounded px-2 py-1 focus:outline-none">
            {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>

          {/* RUN BUTTON */}
          <button
            onClick={handleRun}
            disabled={isRunning}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              isRunning
                ? "bg-green-800 text-green-300 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-500 text-white"
            }`}
          >
            {isRunning ? (
              <><span className="animate-spin">⟳</span> Running...</>
            ) : (
              <>▶ Run</>
            )}
          </button>

          <button onClick={() => setShowChat(!showChat)} className="text-sm bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded transition">
            {showChat ? "Hide Chat" : "Chat"}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor + Output panel */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Monaco Editor */}
          <div className="flex-1 overflow-hidden">
            <Editor
              height="100%"
              language={language}
              value={code}
              onChange={handleCodeChange}
              onMount={handleEditorMount}
              theme="vs-dark"
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                padding: { top: 16 },
                wordWrap: "on",
                scrollBeyondLastLine: false,
                cursorBlinking: "smooth",
              }}
            />
          </div>

          {/* Output Panel */}
          {showOutput && (
            <div className="border-t border-gray-700 bg-gray-900 flex flex-col" style={{ height: outputHeight }}>
              {/* Output header */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-300">Output</span>
                  {output && (
                    <>
                      <span className={`text-xs font-medium ${statusColor(output.status)}`}>
                        ● {output.status}
                      </span>
                      {output.time && <span className="text-xs text-gray-500">{output.time}s</span>}
                      {output.memory && <span className="text-xs text-gray-500">{output.memory}KB</span>}
                      {output.username && (
                        <span className="text-xs text-gray-500">
                          run by <span className="text-blue-400">{output.username}</span>
                        </span>
                      )}
                    </>
                  )}
                  {isRunning && !output && (
                    <span className="text-xs text-yellow-400 animate-pulse">Executing code...</span>
                  )}
                </div>
                <button onClick={() => setShowOutput(false)} className="text-gray-500 hover:text-white text-sm transition">✕</button>
              </div>

              {/* Output content */}
              <div className="flex-1 overflow-auto p-4 font-mono text-sm">
                {isRunning && !output ? (
                  <div className="text-gray-500 animate-pulse">Waiting for Judge0...</div>
                ) : outputText ? (
                  <pre className={`whitespace-pre-wrap ${output?.stderr || output?.compile_output ? "text-red-400" : "text-green-400"}`}>
                    {outputText || <span className="text-gray-500">(no output)</span>}
                  </pre>
                ) : (
                  <span className="text-gray-500">(no output)</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Chat Sidebar */}
        {showChat && (
          <div className="w-72 border-l border-gray-800 flex flex-col bg-gray-900">
            <div className="px-4 py-3 border-b border-gray-800 text-sm font-medium flex items-center justify-between">
              <span>Chat</span>
              <span className="text-xs text-gray-500">as <span className="text-blue-400">{username}</span></span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.length === 0 && (
                <p className="text-gray-600 text-xs text-center mt-4">
                  Share <span className="font-mono text-gray-500">{roomId}</span> to invite others!
                </p>
              )}
              {messages.map((msg, i) =>
                msg.system ? (
                  <div key={i} className="text-center text-gray-600 text-xs py-1">{msg.content}</div>
                ) : (
                  <div key={i} className="text-sm">
                    <span className={`font-medium ${msg.username === username ? "text-blue-400" : "text-green-400"}`}>{msg.username}: </span>
                    <span className="text-gray-300">{msg.content}</span>
                  </div>
                )
              )}
              <div ref={messagesEndRef} />
            </div>
            {typingUsers.filter(u => u !== username).length > 0 && (
              <div className="px-4 py-1 text-xs text-gray-500 italic">
                {typingUsers.filter(u => u !== username).join(", ")} is typing...
              </div>
            )}
            <div className="p-3 border-t border-gray-800 flex gap-2">
              <input
                value={messageInput}
                onChange={handleMessageInput}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Type a message..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
              <button onClick={handleSendMessage} className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg text-sm transition">→</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
