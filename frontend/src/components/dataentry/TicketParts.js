import { useRef, useState } from "react";
import { api, API, errMsg } from "../../lib/api";
import { toast } from "sonner";
import { Paperclip, FileText, Image as ImageIcon, FileSpreadsheet, X, Send } from "lucide-react";

export const inp = "w-full px-3 py-3 sm:py-2 rounded-md border border-input bg-background text-base sm:text-sm focus:ring-2 focus:ring-primary focus:outline-none";
export const priBadge = { low: "bg-muted text-muted-foreground", normal: "bg-blue-500/15 text-blue-500", high: "bg-destructive/15 text-destructive" };
export const statBadge = { open: "bg-primary/20 text-primary", in_progress: "bg-amber-500/15 text-amber-500", completed: "bg-green-500/15 text-green-500", done: "bg-green-500/15 text-green-500", closed: "bg-muted text-muted-foreground" };

const fileIcon = (ct = "") => (ct.startsWith("image/") ? ImageIcon : ct.includes("sheet") || ct.includes("excel") || ct.includes("csv") ? FileSpreadsheet : FileText);
const fmtSize = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const fmtTime = (iso) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export async function uploadTicketFile(file) {
  const fd = new FormData(); fd.append("file", file);
  const { data } = await api.post("/data-entry-tickets/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
  return data;
}

export function AttachmentList({ files, onRemove, base = `${API}/files` }) {
  if (!files?.length) return null;
  return (
    <div className="flex flex-wrap gap-2" data-testid="attachment-list">
      {files.map((f) => { const Icon = fileIcon(f.content_type); return (
        <span key={f.path} className="inline-flex items-center gap-1.5 max-w-full text-xs px-2.5 py-1.5 rounded-md border border-border bg-background" data-testid="attachment-chip">
          <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
          <a href={`${base}/${f.path}`} target="_blank" rel="noreferrer" className="truncate max-w-[160px] hover:underline" title={f.name}>{f.name}</a>
          {f.size ? <span className="text-muted-foreground">{fmtSize(f.size)}</span> : null}
          {onRemove && <button onClick={() => onRemove(f.path)} aria-label="Remove" className="p-0.5 text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>}
        </span>
      ); })}
    </div>
  );
}

export function AttachButton({ onAdd, testid = "ticket-attach-btn", label = "Attach files" }) {
  const ref = useRef();
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    setBusy(true);
    for (const f of files) {
      try { onAdd(await uploadTicketFile(f)); } catch (err) { toast.error(`${f.name}: ${errMsg(err)}`); }
    }
    setBusy(false); e.target.value = "";
  };
  return (
    <>
      <button type="button" onClick={() => ref.current.click()} data-testid={testid} disabled={busy}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary py-2 disabled:opacity-50"><Paperclip className="w-4 h-4" /> {busy ? "Uploading…" : label}</button>
      <input ref={ref} type="file" multiple className="hidden" onChange={pick}
        accept=".jpg,.jpeg,.png,.webp,.gif,.heic,.pdf,.csv,.txt,.xls,.xlsx,.doc,.docx,image/*,application/pdf,text/csv,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
    </>
  );
}

export function MessageThread({ messages = [], mine = "owner", fileBase }) {
  if (!messages.length) return <div className="text-xs text-muted-foreground py-2" data-testid="thread-empty">No replies yet.</div>;
  return (
    <div className="space-y-2" data-testid="ticket-thread">
      {messages.map((m) => (
        <div key={m.id} className={`max-w-[92%] rounded-md px-3 py-2 text-sm ${m.author_role === mine ? "ml-auto bg-primary/15" : "bg-muted"}`} data-testid={`thread-msg-${m.author_role}`}>
          <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5"><span>{m.author_role === "admin" ? `${m.author} · Data-entry team` : m.author}</span><span>{fmtTime(m.created_at)}</span></div>
          {m.body && <div className="whitespace-pre-wrap break-words">{m.body}</div>}
          {m.attachments?.length > 0 && <div className="mt-2"><AttachmentList files={m.attachments} base={fileBase} /></div>}
        </div>
      ))}
    </div>
  );
}

export function ReplyBox({ onSend, allowFiles = true, testid = "ticket-reply" }) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!body.trim() && !files.length) return;
    setBusy(true);
    try { await onSend({ body, attachments: files }); setBody(""); setFiles([]); } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };
  return (
    <div className="mt-3 space-y-2">
      <AttachmentList files={files} onRemove={(p) => setFiles((f) => f.filter((x) => x.path !== p))} />
      <div className="flex gap-2">
        <textarea data-testid={`${testid}-input`} rows={1} placeholder="Write a reply…" className={inp + " flex-1 min-w-0 resize-none"} value={body} onChange={(e) => setBody(e.target.value)} />
        <button onClick={send} disabled={busy} data-testid={`${testid}-send-btn`} aria-label="Send reply" className="shrink-0 px-3 rounded-md bg-primary text-primary-foreground disabled:opacity-50 inline-flex items-center justify-center min-w-[44px]"><Send className="w-4 h-4" /></button>
      </div>
      {allowFiles && <AttachButton onAdd={(f) => setFiles((x) => [...x, f])} testid={`${testid}-attach-btn`} label="Attach" />}
    </div>
  );
}
