import { useRef, useState, useEffect } from "react";
import { X, Camera, Image as ImageIcon, CloudOff } from "lucide-react";
import { api, API, errMsg } from "../../lib/api";
import { enqueue, isOnline, isNetworkError, getQueue, useOffline } from "../../lib/offline";
import { toast } from "sonner";

const readAsDataUrl = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });

export function JobPhotosModal({ job, onClose, onSaved }) {
  const fileRef = useRef();
  const { online, pending } = useOffline();
  const [photos, setPhotos] = useState(job.photos || []);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const queued = getQueue().filter((q) => q.type === "job-photo" && q.jobId === job.id);

  useEffect(() => {
    if (!online) return;
    api.get(`/jobs/${job.id}`).then((r) => { setPhotos(r.data.photos || []); onSaved?.(); }).catch(() => {});
  }, [online, pending, job.id, onSaved]);

  const pick = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setBusy(true);
    const dataUrl = await readAsDataUrl(file);
    const queueIt = () => { enqueue({ type: "job-photo", jobId: job.id, dataUrl, filename: file.name, caption }); toast.info("Saved on device — will upload when back online"); };
    if (!isOnline()) { queueIt(); setBusy(false); setCaption(""); return; }
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const { data: photo } = await api.post(`/jobs/${job.id}/photos`, { path: data.path, caption });
      setPhotos((p) => [...p, photo]); onSaved?.(); toast.success("Photo added"); setCaption("");
    } catch (err) { if (isNetworkError(err)) queueIt(); else toast.error(errMsg(err)); }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-md w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" data-testid="job-photos-modal">
        <div className="flex items-center justify-between mb-1"><h2 className="font-head font-bold text-xl">Job photos</h2><button onClick={onClose}><X className="w-5 h-5" /></button></div>
        <div className="text-sm text-muted-foreground mb-5">{job.name}</div>
        <div className="flex gap-2 mb-5">
          <input data-testid="job-photo-caption" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption (optional)" className="flex-1 px-3 py-2 rounded-md border border-input bg-background text-sm" />
          <button onClick={() => fileRef.current.click()} disabled={busy} data-testid="job-photo-add-btn" className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"><Camera className="w-4 h-4" /> {busy ? "…" : "Add photo"}</button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} data-testid="job-photo-file-input" />
        </div>
        {queued.length > 0 && (
          <div className="mb-4 text-xs text-amber-500 inline-flex items-center gap-1.5" data-testid="job-photos-queued"><CloudOff className="w-3.5 h-3.5" /> {queued.length} photo{queued.length === 1 ? "" : "s"} waiting to upload</div>
        )}
        {photos.length === 0 && queued.length === 0 && <div className="border border-dashed border-border rounded-md p-10 text-center text-muted-foreground text-sm" data-testid="job-photos-empty">No photos yet.</div>}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {queued.map((q) => <div key={q.id} className="relative aspect-square rounded-md overflow-hidden border border-dashed border-amber-500/60 opacity-70"><img src={q.dataUrl} alt="" className="w-full h-full object-cover" /></div>)}
          {photos.map((p) => (
            <figure key={p.id} className="rounded-md overflow-hidden border border-border bg-muted" data-testid="job-photo">
              <div className="aspect-square flex items-center justify-center"><img src={`${API}/files/${p.path}`} alt={p.caption} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.replaceWith(Object.assign(document.createElement("div"), { className: "text-muted-foreground" })); }} /></div>
              {(p.caption || p.by) && <figcaption className="px-2 py-1.5 text-[11px] text-muted-foreground truncate">{p.caption || <ImageIcon className="w-3 h-3 inline" />} · {p.by}</figcaption>}
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}
