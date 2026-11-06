import { useEffect, useState, useCallback } from "react";
import { api } from "./api";

const CACHE_PREFIX = "ht:cache:";
const QUEUE_KEY = "ht:queue";
const EVENT = "ht:offline-change";

const read = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const notify = () => window.dispatchEvent(new Event(EVENT));

export const isOnline = () => navigator.onLine;
export const isNetworkError = (e) => !e?.response;

export async function cachedGet(path) {
  try {
    const { data } = await api.get(path);
    write(CACHE_PREFIX + path, { data, at: Date.now() });
    return { data, fromCache: false };
  } catch (e) {
    const hit = read(CACHE_PREFIX + path, null);
    if (hit && isNetworkError(e)) return { data: hit.data, fromCache: true, at: hit.at };
    throw e;
  }
}

export const getQueue = () => read(QUEUE_KEY, []);

export function enqueue(action) {
  const q = getQueue();
  const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, created_at: new Date().toISOString(), ...action };
  write(QUEUE_KEY, [...q, item]);
  notify();
  return item;
}

const dataUrlToBlob = async (dataUrl) => (await fetch(dataUrl)).blob();

async function run(item) {
  if (item.type === "clock-in" || item.type === "clock-out") {
    await api.post(`/timecards/${item.type}`, { ...item.body, at: item.created_at });
    return;
  }
  if (item.type === "job-photo") {
    const fd = new FormData();
    fd.append("file", await dataUrlToBlob(item.dataUrl), item.filename || "photo.jpg");
    const { data } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
    await api.post(`/jobs/${item.jobId}/photos`, { path: data.path, caption: item.caption || "", taken_at: item.created_at });
  }
}

let flushing = false;
export async function flushQueue() {
  if (flushing || !isOnline()) return { synced: 0, failed: 0 };
  flushing = true;
  let synced = 0, failed = 0;
  for (const item of getQueue()) {
    try { await run(item); synced += 1; }
    catch (e) { if (isNetworkError(e)) { failed += 1; break; } failed += 1; }
    write(QUEUE_KEY, getQueue().filter((q) => q.id !== item.id));
    notify();
  }
  flushing = false;
  notify();
  return { synced, failed };
}

export function useOffline() {
  const [online, setOnline] = useState(isOnline());
  const [pending, setPending] = useState(getQueue().length);
  useEffect(() => {
    const on = () => { setOnline(true); flushQueue(); };
    const off = () => setOnline(false);
    const change = () => setPending(getQueue().length);
    window.addEventListener("online", on); window.addEventListener("offline", off); window.addEventListener(EVENT, change);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); window.removeEventListener(EVENT, change); };
  }, []);
  const sync = useCallback(() => flushQueue(), []);
  return { online, pending, sync };
}

export function registerServiceWorker() {
  if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }
}
