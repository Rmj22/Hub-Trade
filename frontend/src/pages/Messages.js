import { useEffect, useState, useRef } from "react";
import { api, errMsg } from "../lib/api";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function MessagesPage() {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const endRef = useRef();

  const load = () => api.get("/messages").then((r) => setMsgs(r.data)).catch((e) => errMsg(e));
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try { await api.post("/messages", { text }); setText(""); load(); }
    catch (err) { toast.error(errMsg(err)); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]" data-testid="messages-page">
      <div className="mb-4">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Real-time</div>
        <h1 className="font-head font-extrabold text-3xl tracking-tight">Team chat</h1>
      </div>
      <div className="flex-1 border border-border rounded-md bg-card p-4 overflow-y-auto space-y-3">
        {msgs.length === 0 && <div className="text-muted-foreground text-sm text-center py-12">No messages yet. Say hi to the crew.</div>}
        {msgs.map((m) => {
          const mine = m.author_name === user?.name;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`} data-testid="message-row">
              <div className={`max-w-[75%] rounded-md px-4 py-2 ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {!mine && <div className="text-xs font-semibold opacity-70 mb-0.5">{m.author_name} · {m.author_role}</div>}
                <div className="text-sm">{m.text}</div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="flex gap-2 mt-4">
        <input data-testid="message-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Message your crew…"
          className="flex-1 px-4 py-3 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none" />
        <button data-testid="message-send-btn" className="px-5 rounded-md bg-primary text-primary-foreground font-semibold inline-flex items-center gap-2 hover:opacity-90 transition-opacity"><Send className="w-4 h-4" /></button>
      </form>
    </div>
  );
}
