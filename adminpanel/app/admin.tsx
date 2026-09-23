"use client";
import React, { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Page = "dashboard" | "live-activity" | "movies" | "series" | "content-usage" | "users" | "subscriptions" | "plans" | "transactions" | "notifications";

interface Movie {
  id: number; title: string; genre: string; vj: string;
  thumb: string; added: string; type: "movie" | "series"; episodes?: number;
}
interface User {
  id: string; name: string; phone: string; email: string; plan: string; subscriptionStatus: string; joined: string;
}
interface Subscription {
  id: number; email: string; plan: string; startDate: string; endDate: string; status: "active" | "expired";
}
interface Transaction {
  id: string; user: string; email: string; plan: string; amount: string; date: string; status: "success" | "pending" | "failed";
}
interface Notification {
  id: number; title: string; message: string; status: "draft" | "sent"; sentAt?: string;
}


async function authedFetch<T>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
  const { data } = await supabaseBrowser().auth.getSession();
  const token = data.session?.access_token;
  const response = await fetch(input, {
    ...init,
    headers: { ...(init.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body as T;
}

// ── Data ───────────────────────────────────────────────────────────────────
const INIT_NOTIFICATIONS: Notification[] = [
  { id: 1, title: "Payment Successful!", message: "Your Standard Premium subscription has been activated. Enjoy unlimited streaming!", status: "draft" },
  { id: 2, title: "Payment Successful!", message: "Your Basic Premium subscription has been activated. Happy watching!", status: "draft" },
];



// Compute end date from start date + plan duration keyword
function computeEndDate(startIso: string, plan: string): string {
  const d = new Date(startIso);
  const p = plan.toLowerCase();
  if (p.includes("starter") || p.includes("4 hour")) { d.setHours(d.getHours() + 4); return d.toISOString().slice(0, 10); }
  if (p.includes("one day")) d.setDate(d.getDate() + 1);
  else if (p.includes("one week")) d.setDate(d.getDate() + 7);
  else if (p.includes("one month")) d.setMonth(d.getMonth() + 1);
  else if (p.includes("two months")) d.setMonth(d.getMonth() + 2);
  else if (p.includes("three months")) d.setMonth(d.getMonth() + 3);
  else if (p.includes("six months")) d.setMonth(d.getMonth() + 6);
  else if (p.includes("one year")) d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split("T")[0];
}

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ── SVG Icons ──────────────────────────────────────────────────────────────
const Ic = {
  dashboard: () => <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  film: () => <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M17 7h5M2 17h5M17 17h5"/></svg>,
  tv: () => <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>,
  users: () => <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  card: () => <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  tag: () => <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  bell: () => <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  bellSm: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  logout: () => <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  search: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  x: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  edit: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  send: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  menu: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6" strokeLinecap="round"/><line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round"/><line x1="3" y1="18" x2="21" y2="18" strokeLinecap="round"/></svg>,
  eye: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  eyeOff: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  star: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  chart: () => <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M7 16l4-5 3 3 5-7"/></svg>,
  trend: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  shield: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  plus: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
};

// ── Shared UI ──────────────────────────────────────────────────────────────
function TableWrap({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"><div className="overflow-x-auto">{children}</div></div>;
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-4 py-3 text-xs font-600 text-orange-500 uppercase tracking-wider whitespace-nowrap bg-gray-50 border-b border-gray-100">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-sm ${className}`}>{children}</td>;
}
function PlanBadge({ plan }: { plan: string }) {
  if (plan.includes("Standard")) return <span className="px-2.5 py-1 rounded-full text-xs font-600 bg-orange-100 text-orange-700">{plan}</span>;
  if (plan.includes("Basic")) return <span className="px-2.5 py-1 rounded-full text-xs font-600 bg-amber-100 text-amber-700">{plan}</span>;
  return <span className="px-2.5 py-1 rounded-full text-xs font-600 bg-gray-100 text-gray-500">{plan}</span>;
}

// ── Push Notification (content card) Modal ────────────────────────────────
function ContentPushModal({ item, onClose }: { item: Movie; onClose: () => void }) {
  const [title, setTitle] = useState(`New ${item.type}: ${item.title}`);
  const [message, setMessage] = useState(`Check out the new ${item.type} "${item.title}" now available!`);
  const [sendTo, setSendTo] = useState("all");
  const [segments, setSegments] = useState<string[]>(["All"]);
  const segOpts = ["All", "Active Users", "Premium Users", "New Users"];
  const toggle = (s: string) => setSegments(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-700 text-gray-900">Send Push Notification</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 transition-colors"><Ic.x /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-500 text-gray-700 mb-1">Notification Title</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent" value={title} onChange={e => setTitle(e.target.value)} maxLength={100} />
            <p className="text-xs text-gray-400 mt-1">{title.length}/100 characters</p>
          </div>
          <div>
            <label className="block text-sm font-500 text-gray-700 mb-1">Notification Message</label>
            <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" rows={3} value={message} onChange={e => setMessage(e.target.value)} maxLength={200} />
            <p className="text-xs text-gray-400 mt-1">{message.length}/200 characters</p>
          </div>
          <div>
            <label className="block text-sm font-500 text-gray-700 mb-1">Send To</label>
            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" value={sendTo} onChange={e => setSendTo(e.target.value)}>
              <option value="all">Send to All</option>
              <option value="segments">Specific Segments</option>
            </select>
          </div>
          {sendTo === "segments" && (
            <div>
              <label className="block text-sm font-500 text-gray-700 mb-2">Target Segments</label>
              <div className="space-y-2">
                {segOpts.map(s => (
                  <label key={s} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={segments.includes(s)} onChange={() => toggle(s)} className="w-4 h-4 accent-orange-500 rounded" />
                    <span className="text-sm text-gray-700">{s}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-500 text-gray-700 mb-2">Notification Preview</label>
            <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 border border-gray-200">
              <img src={item.thumb} alt={item.title} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
              <div><p className="text-sm font-600 text-gray-900 line-clamp-1">{title}</p><p className="text-xs text-gray-500 line-clamp-2">{message}</p></div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-500 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={async () => { try { await authedFetch("/api/onesignal/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, message }) }); onClose(); } catch (e) { alert(e instanceof Error ? e.message : "Notification failed"); } }} className="px-5 py-2 text-sm font-600 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors">Send Notification</button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Subscription Modal ────────────────────────────────────────────────
function EditSubscriptionModal({ sub, plans, onClose, onSave }: { sub: Subscription; plans: any[]; onClose: () => void; onSave: (updated: Subscription) => void }) {
  const today = todayIso();
  const [plan, setPlan] = useState(sub.plan);
  const [startDate, setStartDate] = useState(sub.startDate?.slice(0, 10) || today);
  const [endDate, setEndDate] = useState(() => computeEndDate(today, sub.plan));

  const handlePlanChange = (p: string) => {
    setPlan(p);
    setEndDate(computeEndDate(today, p));
  };

  const extend = (days: number) => {
    const next = new Date(`${endDate}T00:00:00`);
    next.setDate(next.getDate() + days);
    setEndDate(next.toISOString().slice(0, 10));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-base font-700 text-gray-900">Edit Subscription</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 transition-colors"><Ic.x /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-500 text-gray-700 mb-1">Email</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500" value={sub.email} readOnly />
          </div>
          <div>
            <label className="block text-sm font-500 text-gray-700 mb-1">Plan</label>
            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" value={plan} onChange={e => handlePlanChange(e.target.value)}>
              <option value="">Select a plan</option>
              {plans.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-500 text-gray-700 mb-1">Start Date <span className="text-orange-400 text-xs">(activation date)</span></label>
            <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-500 text-gray-700 mb-1">End Date <span className="text-orange-400 text-xs">(auto-calculated)</span></label>
            <div className="flex gap-2"><input type="date" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" value={endDate} onChange={e => setEndDate(e.target.value)} /><button type="button" onClick={() => extend(7)} className="px-3 rounded-lg border border-orange-200 bg-orange-50 text-orange-600 text-xs font-600">+7 days</button></div>
          </div>
          {plan && (
            <div className="bg-orange-50 border border-orange-100 rounded-lg px-4 py-3 text-xs text-orange-700">
              Active from <strong>{fmtDate(startDate)}</strong> to <strong>{fmtDate(endDate)}</strong>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-500 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={() => onSave({ ...sub, plan, startDate, endDate, status: "active" })} className="px-5 py-2 text-sm font-600 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors">Update Subscription</button>
        </div>
      </div>
    </div>
  );
}

// ── Add / Edit Notification Modal ──────────────────────────────────────────
function NotificationFormModal({ existing, onClose, onSave }: { existing?: Notification; onClose: () => void; onSave: (n: Omit<Notification, "id">) => void }) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [message, setMessage] = useState(existing?.message ?? "");

  const submit = () => {
    if (!title.trim() || !message.trim()) return;
    onSave({ title: title.trim(), message: message.trim(), status: existing?.status ?? "draft" });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-base font-700 text-gray-900">{existing ? "Edit Notification" : "Add Notification"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 transition-colors"><Ic.x /></button>
        </div>
        <div className="p-5 space-y-4">
          <input
            className="w-full border-2 border-orange-400 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-gray-400"
            placeholder="Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <textarea
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none placeholder:text-gray-400"
            placeholder="Message"
            rows={4}
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-500 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={submit} className="px-5 py-2 text-sm font-600 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors">
            {existing ? "Save" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Content Card ───────────────────────────────────────────────────────────
function ContentCard({ item, onNotify }: { item: Movie; onNotify: (item: Movie) => void }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      <div className="relative">
        <img src={item.thumb} alt={item.title} className="w-full h-36 object-cover" />
        <span className="absolute top-2 left-2 bg-orange-500 text-white text-xs font-600 px-2 py-0.5 rounded-full">{item.vj}</span>
        <span className="absolute top-2 right-2 bg-black/60 text-white text-xs font-500 px-2 py-0.5 rounded-full">{item.genre}</span>
        {item.episodes && <span className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">{item.episodes} eps</span>}
      </div>
      <div className="p-3">
        <h3 className="font-600 text-gray-900 text-sm mb-0.5 truncate">{item.title}</h3>
        <p className="text-xs text-gray-400 mb-3">Added {item.added}</p>
        <button onClick={() => onNotify(item)} className="w-full flex items-center justify-center gap-1.5 bg-orange-50 hover:bg-orange-500 text-orange-600 hover:text-white text-xs font-600 py-2 rounded-lg transition-colors border border-orange-200 hover:border-orange-500">
          <Ic.bellSm /> Push Notification
        </button>
      </div>
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, change, icon }: { label: string; value: string; change: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500 font-500 mb-1">{label}</p>
        <p className="text-3xl font-700 text-gray-900 mb-1">{value}</p>
        <p className="text-xs text-green-500 font-500">{change}</p>
      </div>
      <div className="bg-orange-50 w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-orange-500">{icon}</div>
    </div>
  );
}

// ── Live Activity Page ─────────────────────────────────────────────────────
type LiveWindow = "12h" | "24h" | "48h" | "7d";
const LIVE_WINDOWS: { key: LiveWindow; label: string }[] = [
  { key: "12h", label: "Last 12 Hours" },
  { key: "24h", label: "Last 24 Hours" },
  { key: "48h", label: "Last 2 Days" },
  { key: "7d",  label: "Last 7 Days" },
];

function LiveActivityPage() {
  const [data, setData] = useState<any>(null);
  const [window, setWindow] = useState<LiveWindow>("24h");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastTick, setLastTick] = useState(new Date());
  const POLL_INTERVAL = 30_000; // 30 seconds

  const load = React.useCallback((win: LiveWindow) => {
    setLoading(true); setError("");
    authedFetch<any>(`/api/live-activity?window=${win}`)
      .then(d => { setData(d); setLastTick(new Date()); })
      .catch(e => setError(e instanceof Error ? e.message : "Unable to load live activity"))
      .finally(() => setLoading(false));
  }, []);

  // Initial + on window change
  useEffect(() => { load(window); }, [window, load]);

  // Polling every 30s
  useEffect(() => {
    const id = setInterval(() => load(window), POLL_INTERVAL);
    return () => clearInterval(id);
  }, [window, load]);

  // Countdown to next refresh
  const [countdown, setCountdown] = useState(POLL_INTERVAL / 1000);
  useEffect(() => {
    setCountdown(POLL_INTERVAL / 1000);
    const id = setInterval(() => setCountdown(c => c <= 1 ? POLL_INTERVAL / 1000 : c - 1), 1000);
    return () => clearInterval(id);
  }, [lastTick]);

  const buckets: { label: string; count: number }[] = data?.hourlyBuckets || [];
  const maxCount = Math.max(1, ...buckets.map((b: any) => b.count));

  const timeframeCount = (key: string) =>
    (data?.timeframes || []).find((t: any) => t.window === key)?.count ?? 0;

  // Show every Nth label to avoid crowding
  const labelStep = buckets.length > 24 ? 6 : buckets.length > 12 ? 4 : 2;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-700 text-gray-900 flex items-center gap-2">
            Live Activity
            <span className="inline-flex items-center gap-1.5 text-xs font-600 bg-green-50 text-green-600 border border-green-200 px-2.5 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Real-time user activity from the app database</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Refresh in {countdown}s</span>
          <button onClick={() => load(window)} className="px-3 py-2 text-sm font-600 border border-orange-200 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-100 transition-colors">
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Timeframe selector */}
      <div className="flex gap-2 flex-wrap">
        {LIVE_WINDOWS.map(w => (
          <button
            key={w.key}
            onClick={() => setWindow(w.key)}
            className={`px-4 py-2 text-sm font-600 rounded-xl border transition-colors ${
              window === w.key
                ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                : "bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-600"
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>

      {error && <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</div>}

      {/* Top stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {/* Active now */}
        <div className="col-span-2 lg:col-span-1 bg-white rounded-xl border border-green-200 shadow-sm p-5 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
            <p className="text-xs font-600 text-gray-500 uppercase tracking-wide">Active Now</p>
          </div>
          <p className="text-4xl font-700 text-green-600">{loading ? "…" : (data?.activeNow ?? 0).toLocaleString()}</p>
          <p className="text-xs text-gray-400">Users watching in last 5 min</p>
        </div>

        {/* Timeframe cards */}
        {([
          { key: "12h", label: "12 Hours" },
          { key: "24h", label: "24 Hours" },
          { key: "48h", label: "2 Days" },
          { key: "7d",  label: "7 Days" },
        ] as { key: LiveWindow; label: string }[]).map(tf => (
          <div
            key={tf.key}
            onClick={() => setWindow(tf.key)}
            className={`bg-white rounded-xl border shadow-sm p-5 flex flex-col gap-1 cursor-pointer transition-all ${
              window === tf.key ? "border-orange-400 ring-2 ring-orange-100" : "border-gray-100 hover:border-orange-200"
            }`}
          >
            <p className="text-xs font-600 text-gray-500 uppercase tracking-wide">Last {tf.label}</p>
            <p className="text-3xl font-700 text-gray-900">{loading ? "…" : timeframeCount(tf.key).toLocaleString()}</p>
            <p className="text-xs text-gray-400">Unique visitors</p>
            {window === tf.key && (
              <span className="mt-1 text-[10px] font-700 text-orange-600 uppercase tracking-wide">Selected ↑</span>
            )}
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-700 text-gray-900">Visitor Activity</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Unique users per time bucket · {LIVE_WINDOWS.find(w => w.key === window)?.label}
              {data?.windowUsers != null && (
                <span className="ml-2 text-orange-600 font-600">{data.windowUsers.toLocaleString()} total unique</span>
              )}
            </p>
          </div>
          {loading && <span className="text-xs text-gray-400 animate-pulse">Updating…</span>}
        </div>

        {buckets.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            {loading ? "Loading…" : "No activity data in this window"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div
              className="flex items-end gap-0.5 min-w-0"
              style={{ height: 160, minWidth: buckets.length * 14 }}
            >
              {buckets.map((b, i) => {
                const heightPct = maxCount === 0 ? 0 : Math.max(2, Math.round((b.count / maxCount) * 100));
                const isHigh = b.count >= maxCount * 0.8;
                return (
                  <div key={i} className="relative flex flex-col items-center flex-1 group" style={{ minWidth: 12 }}>
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                      <div className="bg-gray-900 text-white text-[10px] font-600 px-2 py-1 rounded-md whitespace-nowrap">
                        {b.count} user{b.count !== 1 ? "s" : ""}
                        <div className="text-gray-400 font-400">{b.label}</div>
                      </div>
                      <div className="w-1.5 h-1.5 bg-gray-900 rotate-45 -mt-0.5" />
                    </div>
                    {/* Bar */}
                    <div
                      className={`w-full rounded-t-sm transition-all duration-500 ${
                        isHigh ? "bg-orange-500" : b.count > 0 ? "bg-orange-300" : "bg-gray-100"
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                );
              })}
            </div>
            {/* X-axis labels */}
            <div
              className="flex gap-0.5 mt-1"
              style={{ minWidth: buckets.length * 14 }}
            >
              {buckets.map((b, i) => (
                <div key={i} className="flex-1 text-center" style={{ minWidth: 12 }}>
                  {i % labelStep === 0 && (
                    <span className="text-[9px] text-gray-400 whitespace-nowrap">{b.label}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Last updated */}
      <p className="text-xs text-gray-400 text-right">
        Last updated: {lastTick.toLocaleTimeString("en-GB")} · auto-refreshes every 30s
      </p>
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────
function DashboardPage() {
  const [stats, setStats] = useState({ users: 0, movies: 0, series: 0, premium: 0, activeNow: 0, active24h: 0, active30d: 0, newActive24h: 0, oldActive24h: 0, newActive30d: 0, oldActive30d: 0 });
  const [latestMovies, setLatestMovies] = useState<Movie[]>([]);
  const [latestSeries, setLatestSeries] = useState<Movie[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeNow, setActiveNow] = useState(0);

  // Full dashboard load (stats + latest content + transactions)
  useEffect(() => {
    let active = true;
    Promise.all([
      authedFetch<any>("/api/dashboard"),
      authedFetch<any>("/api/transactions?limit=10"),
    ]).then(([dashboard, tx]) => {
      if (!active) return;
      const s = dashboard.stats || {};
      setStats({ users: s.users || 0, movies: s.movies || 0, series: s.series || 0, premium: s.premium || 0, activeNow: s.activeNow || 0, active24h: s.active24h || 0, active30d: s.active30d || 0, newActive24h: s.newActive24h || 0, oldActive24h: s.oldActive24h || 0, newActive30d: s.newActive30d || 0, oldActive30d: s.oldActive30d || 0 });
      setActiveNow(s.activeNow || 0);
      setLatestMovies(dashboard.latestMovies || []);
      setLatestSeries(dashboard.latestSeries || []);
      const rows = Array.isArray(tx) ? tx : (tx.data || tx.transactions || []);
      setTransactions(rows.slice(0, 10));
    }).catch(e => active && setError(e instanceof Error ? e.message : "Unable to load dashboard data"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  // Poll activeNow every 30s independently (lightweight)
  useEffect(() => {
    const poll = () => {
      authedFetch<any>("/api/dashboard").then(d => {
        setActiveNow(d.stats?.activeNow || 0);
      }).catch(() => {});
    };
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, []);

  const txStatus = (status: string) => {
    const s = (status || "").toLowerCase();
    return s === "completed" || s === "success" ? "bg-green-100 text-green-700" : s === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-500";
  };
  const mapTx = (tx: any) => {
    const amt = tx.amount != null
      ? `${Number(tx.amount).toLocaleString()} ${tx.currency || "UGX"}`
      : "—";
    return {
      id: tx.reference ?? tx.provider_transaction_id ?? String(tx.id) ?? "—",
      user: tx.phone_number || "Customer",
      email: "",
      plan: tx.provider ? `via ${tx.provider}` : "Payment",
      amount: amt,
      date: tx.created_at ? new Date(tx.created_at).toLocaleDateString("en-GB") : "—",
      status: tx.status || "pending",
    };
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-700 text-gray-900">Welcome back!</h1><p className="text-sm text-gray-400 mt-0.5">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p></div>
      {error && <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total Users" value={loading ? "…" : stats.users.toLocaleString()} change="From Supabase" icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>} />
        <StatCard label="Total Movies" value={loading ? "…" : stats.movies.toLocaleString()} change="From Reelplexi" icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M17 7h5M2 17h5M17 17h5"/></svg>} />
        <StatCard label="Total Series" value={loading ? "…" : stats.series.toLocaleString()} change="From Reelplexi" icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>} />
        <StatCard label="Premium Subscribers" value={loading ? "…" : stats.premium.toLocaleString()} change="Active subscriptions" icon={<Ic.star />} />
        {/* Active now — live card with pulse, polls every 30s */}
        <div className="bg-white rounded-xl border border-green-200 shadow-sm p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-500 mb-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
              Active Now
            </p>
            <p className="text-3xl font-700 text-green-600 mb-1">{loading ? "…" : activeNow.toLocaleString()}</p>
            <p className="text-xs text-green-500 font-500">Watching · last 5 min</p>
          </div>
          <div className="bg-green-50 w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-green-500">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {[
          ["Active Users, 24h", stats.active24h, `${stats.newActive24h} new · ${stats.oldActive24h} returning`],
          ["Active Users, 30d", stats.active30d, `${stats.newActive30d} new · ${stats.oldActive30d} returning`],
          ["Current Premium", stats.premium, "Live Supabase subscription status"],
        ].map(([label, value, detail]) => <div key={String(label)} className="rounded-xl border border-blue-100 bg-blue-50 p-4 shadow-sm"><p className="text-2xl font-700 text-blue-700">{loading ? "…" : Number(value).toLocaleString()}</p><p className="text-xs font-600 text-gray-700 mt-1">{label}</p><p className="text-xs text-gray-500 mt-1">{detail}</p></div>)}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[{ label: "Latest Movies", data: latestMovies }, { label: "Latest Series", data: latestSeries }].map(({ label, data }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-700 text-gray-900 mb-0.5">{label}</h2><p className="text-xs text-gray-400 mb-4">Recently added to Reelplexi</p>
            {loading ? <p className="text-sm text-gray-400 py-5">Loading…</p> : data.length === 0 ? <p className="text-sm text-gray-400 py-5">No content returned.</p> : <div className="space-y-0.5">{data.map((m, i) => <div key={`${m.type}-${m.id}`} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0"><span className="w-7 h-7 rounded-full bg-orange-50 text-orange-500 text-xs font-700 flex items-center justify-center flex-shrink-0">{i + 1}</span><span className="flex-1 text-sm font-500 text-gray-800 truncate">{m.title}</span><span className="text-xs text-gray-400 flex-shrink-0">{m.added}</span></div>)}</div>}
          </div>
        ))}
      </div>
      <TableWrap>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white"><div><h2 className="font-700 text-gray-900">Recent Transactions</h2><p className="text-xs text-gray-400 mt-0.5">Latest completed subscription payments</p></div><span className="text-xs bg-orange-50 text-orange-600 font-600 px-3 py-1 rounded-full">{transactions.length} records</span></div>
        <table className="w-full text-sm min-w-[700px]"><thead><tr><Th>#</Th><Th>Transaction</Th><Th>Description</Th><Th>Amount</Th><Th>Date</Th><Th>Status</Th></tr></thead><tbody>{transactions.map((raw, i) => { const tx=mapTx(raw); return <tr key={`${tx.id}-${i}`} className={`border-b border-gray-50 hover:bg-orange-50/30 transition-colors ${i%2===1?"bg-gray-50/30":""}`}><Td className="font-mono text-xs text-gray-400">{tx.id}</Td><Td className="text-gray-600 text-xs">{tx.user}</Td><Td className="text-gray-600 text-xs">{tx.plan}</Td><Td className="font-600 text-gray-900">{tx.amount}</Td><Td className="text-gray-500 whitespace-nowrap">{tx.date}</Td><Td><span className={`px-2.5 py-1 rounded-full text-xs font-600 ${txStatus(tx.status)}`}>{String(tx.status).charAt(0).toUpperCase()+String(tx.status).slice(1)}</span></Td></tr>; })}</tbody></table>
      </TableWrap>
    </div>
  );
}

// ── Content Page ───────────────────────────────────────────────────────────
function ContentPage({ type }: { type: "movie" | "series" }) {
  const pageSize = 30;
  const [search, setSearch] = useState("");
  const [notifyItem, setNotifyItem] = useState<Movie | null>(null);
  const [data, setData] = useState<Movie[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const searchQuery = search.trim() ? `&search=${encodeURIComponent(search.trim())}` : "";
    const endpoint = type === "movie" ? `/v1/movies?per_page=${pageSize}&page=1${searchQuery}` : `/v1/series?per_page=${pageSize}&page=1${searchQuery}`;
    authedFetch<any>(`/api/reelplex?path=${encodeURIComponent(endpoint.slice(0, endpoint.indexOf("?")))}&${endpoint.split("?")[1]}`)
      .then(body => {
        if (!active) return;
        if (body.error) throw new Error(body.error);
        const mapped = (body.data || []).map((m: any) => ({
          id: m.id, title: m.title, genre: Array.isArray(m.genres) ? m.genres[0] || "Uncategorized" : m.genre || "Uncategorized",
          vj: m.vj || "—", thumb: m.poster_url || m.backdrop_url || "", added: m.release_date || "—", type, episodes: m.episodes,
        }));
        setData(mapped);
        setTotal(body.pagination?.total ?? mapped.length);
        setPage(1);
        setHasMore(mapped.length < (body.pagination?.total ?? mapped.length));
      })
      .catch(e => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [type, search]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const path = type === "movie" ? "/v1/movies" : "/v1/series";
      const searchQuery = search.trim() ? `&search=${encodeURIComponent(search.trim())}` : "";
      const body = await authedFetch<any>(`/api/reelplex?path=${encodeURIComponent(path)}&per_page=${pageSize}&page=${nextPage}${searchQuery}`);
      if (body.error) throw new Error(body.error);
      const mapped = (body.data || []).map((m: any) => ({
        id: m.id, title: m.title, genre: Array.isArray(m.genres) ? m.genres[0] || "Uncategorized" : m.genre || "Uncategorized",
        vj: m.vj || "—", thumb: m.poster_url || m.backdrop_url || "", added: m.release_date || "—", type, episodes: m.episodes,
      }));
      setData(previous => [...previous, ...mapped]);
      setPage(nextPage);
      setTotal(body.pagination?.total ?? total);
      setHasMore(mapped.length === pageSize && (page * pageSize + mapped.length) < (body.pagination?.total ?? total));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load more content");
    } finally {
      setLoadingMore(false);
    }
  };

  const filtered = data;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-700 text-gray-900">{type === "movie" ? "Movies" : "TV Series"}</h1>
        <p className="text-sm text-gray-400">{total} total {type === "movie" ? "movies" : "series"}</p>
      </div>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Ic.search /></span>
        <input className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" placeholder="Search by title, genre, or VJ…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      {loading ? <div className="text-center py-16 text-gray-400">Loading content…</div> : error ? <div className="text-center py-16 text-red-500">{error}</div> : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No results found.</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map(item => <ContentCard key={item.id} item={item} onNotify={setNotifyItem} />)}
        </div>
      )}
      {!loading && !error && hasMore && <div className="flex justify-center"><button onClick={loadMore} disabled={loadingMore} className="px-5 py-2.5 text-sm font-600 border border-orange-200 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-100 disabled:opacity-50">{loadingMore ? "Loading…" : "Load more"}</button></div>}
      {notifyItem && <ContentPushModal item={notifyItem} onClose={() => setNotifyItem(null)} />}
    </div>
  );
}

// ── Users Page ─────────────────────────────────────────────────────────────
function UsersPage() {
  const pageSize = 30;
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [totalPremium, setTotalPremium] = useState(0);
  const [totalTrial, setTotalTrial] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [resettingId, setResettingId] = useState<string | null>(null);

  const loadUsers = async (nextPage: number, append: boolean) => {
    const searchQuery = search.trim() ? `&search=${encodeURIComponent(search.trim())}` : "";
    const body = await authedFetch<any>(`/api/users?page=${nextPage}&per_page=${pageSize}${searchQuery}`);
      const mapped = (body.users || []).map((u: any) => ({
        id: u.id,
        name: u.profile?.full_name || u.user_metadata?.full_name || u.email || "Unnamed user",
        phone: u.profile?.phone || u.phone || u.user_metadata?.phone || "—",
        email: u.email || "—",
        plan: u.subscription?.status === "active" ? (u.subscription?.plan || "Premium") : "Free",
        subscriptionStatus: u.subscription?.status || "free",
        joined: u.created_at?.slice(0,10) || "—",
      }));
      setTotalPremium(Number(body.totalPremium || 0));
      setTotalTrial(Number(body.totalTrial || 0));
      setUsers(previous => {
        const combined = append ? [...previous, ...mapped] : mapped;
        return combined.sort((a: User, b: User) => b.joined.localeCompare(a.joined));
      });
      setPage(nextPage);
      setHasMore(mapped.length === pageSize);
  };

  useEffect(() => {
    loadUsers(1, false).catch(e => { setUsers([]); setError(e instanceof Error ? e.message : "Unable to load users"); }).finally(() => setLoading(false));
  }, [search]);

  const loadMoreUsers = async () => {
    setLoadingMore(true);
    try { await loadUsers(page + 1, true); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load more users"); }
    finally { setLoadingMore(false); }
  };
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null);

  const filtered = users;

  const sendReset = async (user: User) => {
    if (!user.email || user.email === "—") return;
    setResettingId(user.id);
    setError("");
    try {
      await authedFetch("/api/users/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id }) });
      setToast("Reset link sent to user");
      window.setTimeout(() => setToast(""), 3000);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to send reset email"); }
    finally { setResettingId(null); }
  };

  return (
    <div className="space-y-5">
      {toast && <div className="fixed top-5 right-5 z-[70] bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl text-sm font-600">{toast}</div>}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-700 text-gray-900">Users</h1>
          <p className="text-sm text-gray-400">{users.length} total registered users</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 bg-white border border-gray-100 rounded-xl px-4 py-2 shadow-sm">
          <Ic.star />
          <span><strong className="text-orange-500">{totalPremium.toLocaleString()}</strong> premium paid</span>
          <span className="border-l border-gray-200 pl-2"><strong className="text-blue-500">{totalTrial.toLocaleString()}</strong> trial</span>
        </div>
      </div>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Ic.search /></span>
        <input className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" placeholder="Search by name or email address…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      {loading ? <div className="text-center py-16 text-gray-400">Loading users…</div> : error ? <div className="text-center py-16 text-red-500">{error}</div> : <TableWrap>
        <table className="w-full text-sm min-w-[980px]">
          <thead><tr><Th>Name</Th><Th>Phone</Th><Th>Email</Th><Th>Plan</Th><Th>Status</Th><Th>Joined</Th><Th>Actions</Th></tr></thead>
          <tbody>
            {filtered.map((user, i) => (
              <tr key={user.id} className={`border-b border-gray-50 hover:bg-orange-50/30 transition-colors ${i % 2 === 1 ? "bg-gray-50/30" : ""}`}>
                <Td>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 text-xs font-700 flex items-center justify-center flex-shrink-0">{user.name.charAt(0)}</div>
                    <span className="font-500 text-gray-900 whitespace-nowrap">{user.name}</span>
                  </div>
                </Td>
                <Td className="text-gray-600 whitespace-nowrap">{user.phone}</Td>
                <Td className="text-gray-600">{user.email}</Td>
                <Td><PlanBadge plan={user.plan} /></Td>
                <Td><span className={`px-2.5 py-1 rounded-full text-xs font-600 ${user.subscriptionStatus === "active" ? "bg-green-100 text-green-700" : user.subscriptionStatus === "cancelled" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"}`}>{user.subscriptionStatus}</span></Td>
                <Td className="text-gray-400 whitespace-nowrap">{user.joined}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <button onClick={() => sendReset(user)} disabled={resettingId === user.id} className="px-3 py-1.5 text-xs font-600 bg-white border border-orange-200 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors whitespace-nowrap disabled:opacity-50">
                      {resettingId === user.id ? "Sending…" : "Send Password Reset"}
                    </button>
                    <button onClick={() => alert("Subscription changes should be made through the subscription flow.")} className="px-3 py-1.5 text-xs font-600 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors whitespace-nowrap">
                      Subscribe
                    </button>
                    <button onClick={() => setConfirmDelete(user)} className="px-3 py-1.5 text-xs font-600 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors">
                      Delete
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No users found.</td></tr>}
          </tbody>
        </table>
      </TableWrap>}
      {!loading && !error && hasMore && <div className="flex justify-center"><button onClick={loadMoreUsers} disabled={loadingMore} className="px-5 py-2.5 text-sm font-600 border border-orange-200 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-100 disabled:opacity-50">{loadingMore ? "Loading…" : "Load more"}</button></div>}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-700 text-gray-900 mb-2">Delete Account?</h3>
            <p className="text-sm text-gray-500 mb-5">Permanently delete <strong>{confirmDelete.name}</strong>{"'"}s account? This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm font-500 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={async () => { try { await authedFetch(`/api/users?id=${encodeURIComponent(confirmDelete.id)}`, { method: "DELETE" }); setUsers(p => p.filter(u => u.id !== confirmDelete.id)); } finally { setConfirmDelete(null); } }} className="px-4 py-2 text-sm font-600 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Subscriptions Page ─────────────────────────────────────────────────────
function SubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [editSub, setEditSub] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      authedFetch<any[]>("/api/subscriptions"),
      authedFetch<any>("/api/plans"),
    ]).then(([rows, planBody]) => {
      setSubs(rows.map((s: any) => ({ id: s.id, email: s.email || s.user_email || s.user_id, plan: s.plan, startDate: s.start_date, endDate: s.end_date, status: s.status })));
      setPlans(planBody.plans || []);
    }).catch(e => { setSubs([]); setError(e instanceof Error ? e.message : "Unable to load subscriptions"); }).finally(() => setLoading(false));
  }, []);

  const active = subs.filter(s => s.status === "active");
  const basic = active.filter(s => s.plan.toLowerCase().startsWith("basic")).length;
  const standard = active.filter(s => s.plan.toLowerCase().startsWith("standard")).length;
  const goPlus = active.filter(s => s.plan.toLowerCase().includes("go plus")).length;
  const premiumTrial = active.filter(s => s.plan.toLowerCase().includes("trial")).length;
  const subscriptionPlans = plans.some(p => String(p.display_name || p.name).toLowerCase().includes("go plus")) ? plans : [...plans, { id: "go-plus", name: "Go Plus", display_name: "Go Plus" }];

  const handleSave = async (updated: Subscription) => {
    const saved = await authedFetch<any>("/api/subscriptions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: updated.id, plan: updated.plan, start_date: updated.startDate, end_date: updated.endDate, status: updated.status }) });
    setSubs(p => p.map(s => s.id === updated.id ? { ...updated, status: saved.status || updated.status } : s));
    setEditSub(null);
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-700 text-gray-900">Subscriptions</h1><p className="text-sm text-gray-400">Manage and track subscriber accounts</p></div>
      {error && <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Active Subscribers", value: active.length, color: "text-gray-900" },
          { label: "Basic Premium", value: basic, color: "text-orange-500" },
          { label: "Standard Premium", value: standard, color: "text-orange-600" },
          { label: "Go Plus", value: goPlus, color: "text-violet-600" },
          { label: "Premium Users on Trial", value: premiumTrial, color: "text-blue-600" },
          { label: "Expired", value: subs.filter(s => s.status !== "active").length, color: "text-gray-500" },
        ].map(s => <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"><p className="text-sm text-gray-500 mb-1">{s.label}</p><p className={`text-3xl font-700 ${s.color}`}>{loading ? "…" : s.value.toLocaleString()}</p><p className="text-xs text-gray-400 mt-1">Live Supabase data</p></div>)}
      </div>
      <TableWrap>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white"><h2 className="font-700 text-gray-900">Subscriptions</h2><span className="text-xs text-gray-400">{subs.length} records</span></div>
        {loading ? <div className="text-center py-16 text-gray-400">Loading subscriptions…</div> : <table className="w-full text-sm min-w-[700px]"><thead><tr><Th>Email</Th><Th>Plan</Th><Th>Start Date</Th><Th>End Date</Th><Th>Status</Th><Th>Actions</Th></tr></thead><tbody>{subs.map((sub, i) => <tr key={sub.id} className={`border-b border-gray-50 hover:bg-orange-50/30 transition-colors ${i%2===1?"bg-gray-50/30":""}`}><Td className="font-500 text-gray-800">{sub.email}</Td><Td className="text-gray-600 text-xs">{sub.plan}</Td><Td className="text-gray-500 whitespace-nowrap">{fmtDate(sub.startDate)}</Td><Td className="text-gray-500 whitespace-nowrap">{fmtDate(sub.endDate)}</Td><Td><span className={`px-2.5 py-1 rounded-full text-xs font-600 ${sub.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-500"}`}>{sub.status === "active" ? "Active" : "Expired"}</span></Td><Td><button onClick={() => setEditSub(sub)} className="flex items-center gap-1.5 text-xs font-600 text-orange-600 border border-orange-200 bg-orange-50 hover:bg-orange-500 hover:text-white px-3 py-1.5 rounded-lg transition-colors"><Ic.edit /> Edit</button></Td></tr>)}</tbody></table>}
      </TableWrap>
      {editSub && <EditSubscriptionModal sub={editSub} plans={subscriptionPlans} onClose={() => setEditSub(null)} onSave={handleSave} />}
    </div>
  );
}

// ── Plans Page ─────────────────────────────────────────────────────────────
function PlansPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    authedFetch<any>("/api/plans").then(body => setPlans(body.plans || []))
      .catch(e => setError(e instanceof Error ? e.message : "Unable to load plans"))
      .finally(() => setLoading(false));
  }, []);

  const basic    = plans.filter(p => String(p.tier || p.name || "").toLowerCase().includes("basic") && !String(p.tier || p.name || "").toLowerCase().includes("pro") && !String(p.tier || p.name || "").toLowerCase().includes("standard"));
  const standard = plans.filter(p => String(p.tier || p.name || "").toLowerCase().includes("standard"));
  const pro      = plans.filter(p => String(p.tier || p.name || "").toLowerCase().includes("pro") && !String(p.tier || p.name || "").toLowerCase().includes("standard"));

  type TierStyle = { border: string; header: string; badge: string; dot: string; label: string; tag?: string };
  const TIER_STYLES: Record<string, TierStyle> = {
    Basic:    { border: "border-gray-200",    header: "bg-gray-50",           badge: "",                             dot: "bg-gray-100 text-gray-500",    label: "text-gray-700" },
    Standard: { border: "border-orange-300",  header: "bg-orange-50",         badge: "bg-orange-500 text-white",     dot: "bg-orange-50 text-orange-500",  label: "text-orange-600", tag: "Popular" },
    Pro:      { border: "border-violet-300",  header: "bg-violet-50",         badge: "bg-violet-600 text-white",     dot: "bg-violet-50 text-violet-600",  label: "text-violet-700", tag: "Best Value" },
  };

  const PlanGroup = ({ tier, rows }: { tier: string; rows: any[] }) => {
    const s = TIER_STYLES[tier] ?? TIER_STYLES.Basic;
    if (rows.length === 0) return null;
    return (
      <div className={`bg-white rounded-xl border ${s.border} shadow-sm overflow-hidden flex flex-col`}>
        <div className={`${s.header} px-5 py-4 border-b ${s.border} flex items-center justify-between`}>
          <div>
            <h2 className={`font-700 text-base ${s.label}`}>{tier} Premium</h2>
            <p className="text-xs text-gray-400 mt-0.5">{rows.length} pricing option{rows.length !== 1 ? "s" : ""}</p>
          </div>
          {s.tag && <span className={`text-xs font-700 px-2.5 py-1 rounded-full ${s.badge}`}>{s.tag}</span>}
        </div>
        <div className="divide-y divide-gray-50 flex-1">
          {rows.map((p, i) => (
            <div key={p.id} className={`flex items-center justify-between px-5 py-3.5 ${i % 2 ? "bg-gray-50/30" : ""}`}>
              <div className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full text-xs font-700 flex items-center justify-center flex-shrink-0 ${s.dot}`}>{i + 1}</span>
                <div>
                  <span className="text-sm font-600 text-gray-800">
                    UGX {Number(p.amount ?? 0).toLocaleString()}
                  </span>
                  <span className="ml-2 text-xs text-gray-400">
                    {p.duration_in_days ?? p.duration_days ?? p.duration ?? "—"} days
                  </span>
                  {p.description ? <p className="text-xs text-gray-400 mt-0.5">{p.description}</p> : null}
                </div>
              </div>
              {p.recommended && tier !== "Standard" && (
                <span className={`text-[10px] font-700 px-2 py-0.5 rounded-full ${s.badge}`}>Recommended</span>
              )}
            </div>
          ))}
        </div>
        <div className={`px-5 py-3 border-t ${s.border} ${s.header}`}>
          <p className="text-xs text-gray-400">
            Total revenue potential: UGX {rows.reduce((s, p) => s + Number(p.amount ?? 0), 0).toLocaleString()}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-700 text-gray-900">Subscription Plans</h1>
        <p className="text-sm text-gray-400">{plans.length} plans across {[basic, standard, pro].filter(g => g.length > 0).length} tiers — fetched from Supabase</p>
      </div>
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading plans…</div>
      ) : error ? (
        <div className="text-center py-16 text-red-500">{error}</div>
      ) : plans.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No plans found.</div>
      ) : (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Basic Plans",    count: basic.length,    color: "text-gray-700",    bg: "bg-gray-50   border-gray-200" },
              { label: "Standard Plans", count: standard.length, color: "text-orange-600",  bg: "bg-orange-50 border-orange-200" },
              { label: "Pro Plans",      count: pro.length,      color: "text-violet-700",  bg: "bg-violet-50 border-violet-200" },
            ].map(({ label, count, color, bg }) => (
              <div key={label} className={`rounded-xl border ${bg} p-4 text-center`}>
                <p className={`text-2xl font-700 ${color}`}>{count}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Plan columns */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <PlanGroup tier="Basic"    rows={basic} />
            <PlanGroup tier="Standard" rows={standard} />
            <PlanGroup tier="Pro"      rows={pro} />
          </div>
        </>
      )}
    </div>
  );
}

// ── Content Usage Page ─────────────────────────────────────────────────────
function ContentUsagePage() {
  const [usage, setUsage] = useState<any>(null);
  const [localAnalytics, setLocalAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"all" | "movies" | "series">("all");
  const [timeframe, setTimeframe] = useState<"alltime" | "month" | "week" | "day">("alltime");
  const [dailyDays, setDailyDays] = useState(7);

  const TIMEFRAME_LABELS: Record<string, string> = {
    alltime: "All Time",
    month: "This Month",
    week: "Last 7 Days",
    day: "Today",
  };

  const load = (tf = timeframe, days = dailyDays) => {
    setLoading(true); setError("");
    Promise.all([
      authedFetch<any>(`/api/reelplex-usage?timeframe=${tf}`),
      authedFetch<any>(`/api/analytics?days=${days}&timeframe=${tf}`),
    ])
      .then(([reelplexi, analytics]) => { setUsage(reelplexi); setLocalAnalytics(analytics); })
      .catch(e => setError(e instanceof Error ? e.message : "Unable to load Reelplexi analytics"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(timeframe, dailyDays); }, [timeframe, dailyDays]); // eslint-disable-line react-hooks/exhaustive-deps

  const topViews = usage
    ? tab === "movies" ? (usage.topMovies || [])
    : tab === "series" ? (usage.topSeries || [])
    : (usage.topViews || [])
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-700 text-gray-900">Content Usage</h1>
          <p className="text-sm text-gray-400 mt-0.5">Reelplexi analytics — your organisation's most viewed content</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Timeframe selector */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(["alltime", "month", "week", "day"] as const).map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1.5 text-xs font-600 rounded-md transition-colors ${timeframe === tf ? "bg-white text-orange-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                {TIMEFRAME_LABELS[tf]}
              </button>
            ))}
          </div>
          <button onClick={() => load(timeframe)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-600 border border-orange-200 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-100 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 .49-4.11"/></svg>
            Refresh
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-center py-20 text-gray-400">
          <div className="w-8 h-8 border-2 border-orange-300 border-t-orange-500 rounded-full animate-spin mx-auto mb-3" />
          Loading analytics…
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-5 text-sm text-red-600 flex items-start gap-2">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {error}
        </div>
      )}

      {!loading && usage && (<>
        {localAnalytics?.summary && <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            ["Watched Movies", localAnalytics.summary.total_movie_streams],
            ["Watched Series", localAnalytics.summary.total_series_streams],
            ["Watch Time", `${Math.round(Number(localAnalytics.summary.total_watch_seconds || 0) / 3600)}h`],
            ["Downloads", localAnalytics.summary.total_downloads],
            ["Searches", localAnalytics.summary.total_searches],
            ["ReelPlexi Requests", localAnalytics.summary.total_reelplexi_requests],
            ["Completed", localAnalytics.summary.total_completed_streams],
            ["Incomplete", localAnalytics.summary.total_incomplete_streams],
          ].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"><p className="text-2xl font-700 text-gray-900">{typeof value === "number" ? value.toLocaleString() : String(value)}</p><p className="text-xs text-gray-500 mt-1">{label}</p></div>)}
        </div>}

        {localAnalytics?.viewerStats && <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            ["Total Views", localAnalytics.viewerStats.totalViews],
            ["Unique Viewers", localAnalytics.viewerStats.uniqueViewers],
            ["Active Viewers, 24h", localAnalytics.viewerStats.activeViewers24h],
            ["Movie / Series Views", `${Number(localAnalytics.viewerStats.movieViews || 0).toLocaleString()} / ${Number(localAnalytics.viewerStats.seriesViews || 0).toLocaleString()}`],
          ].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-orange-100 bg-orange-50 p-4 shadow-sm"><p className="text-2xl font-700 text-orange-700">{typeof value === "number" ? value.toLocaleString() : String(value)}</p><p className="text-xs text-gray-600 mt-1">{label} · {TIMEFRAME_LABELS[timeframe]}</p></div>)}
        </div>}

        {localAnalytics?.downloadStats && <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            ["Download Requests", localAnalytics.downloadStats.totalRequests],
            ["Successful Downloads", localAnalytics.downloadStats.successful],
            ["Limit Reached", localAnalytics.downloadStats.limitReached],
            ["Failed Requests", localAnalytics.downloadStats.failed],
          ].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-blue-100 bg-blue-50 p-4 shadow-sm"><p className="text-2xl font-700 text-blue-700">{Number(value || 0).toLocaleString()}</p><p className="text-xs text-gray-600 mt-1">{label} · {TIMEFRAME_LABELS[timeframe]}</p></div>)}
        </div>}

        {localAnalytics?.audience && <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            ["New Users", localAnalytics.audience.newUsers],
            ["Streams by New Users", localAnalytics.audience.newUserStreams],
            ["Streams by Old Users", localAnalytics.audience.oldUserStreams],
          ].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-orange-100 bg-orange-50 p-4"><p className="text-2xl font-700 text-orange-700">{Number(value || 0).toLocaleString()}</p><p className="text-xs text-gray-600 mt-1">{label} · {TIMEFRAME_LABELS[timeframe]}</p></div>)}
        </div>}

        {localAnalytics?.daily?.length > 0 && <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-700 text-gray-900">Daily Usage Trends</h2><p className="text-xs text-gray-400 mt-0.5">Newest day first, starting with today.</p></div><button onClick={() => setDailyDays(days => days + 7)} disabled={loading} className="px-3.5 py-2 text-xs font-600 border border-orange-200 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 disabled:opacity-50">Load more</button></div><div className="mt-4 overflow-x-auto"><table className="w-full text-sm min-w-[680px]"><thead><tr><Th>Date</Th><Th>Views</Th><Th>Watch Seconds</Th><Th>Downloads</Th><Th>Searches</Th><Th>API Requests</Th></tr></thead><tbody>{localAnalytics.daily.map((day: any) => <tr key={day.usage_date} className="border-b border-gray-50"><Td>{day.usage_date}</Td><Td>{Number(day.views || 0).toLocaleString()}</Td><Td>{Number(day.watch_seconds || 0).toLocaleString()}</Td><Td>{Number(day.downloads || 0).toLocaleString()}</Td><Td>{Number(day.searches || 0).toLocaleString()}</Td><Td>{Number(day.reelplexi_requests || 0).toLocaleString()}</Td></tr>)}</tbody></table></div></div>}

        {localAnalytics?.topContent?.length > 0 && <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"><div className="px-5 py-4 border-b border-gray-100"><h2 className="font-700 text-gray-900">Most Viewed Local Content</h2><p className="text-xs text-gray-400 mt-0.5">Playback events recorded by Kilax, including watch time.</p></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><Th>Type</Th><Th>Title</Th><Th>Content ID</Th><Th>Views</Th><Th>Watch Seconds</Th></tr></thead><tbody>{localAnalytics.topContent.map((item: any) => <tr key={`${item.content_type}-${item.content_id}`} className="border-b border-gray-50"><Td>{item.content_type}</Td><Td className="font-600">{item.content_title || "Untitled"}</Td><Td className="text-gray-500">{item.content_id}</Td><Td className="font-700 text-orange-600">{Number(item.views || 0).toLocaleString()}</Td><Td>{Number(item.watch_seconds || 0).toLocaleString()}</Td></tr>)}</tbody></table></div></div>}

        {localAnalytics?.providerStats && <div className="rounded-xl border border-orange-100 bg-orange-50 p-5"><h2 className="font-700 text-gray-900">ReelPlexi Account Usage</h2><div className="grid grid-cols-2 gap-4 mt-3 md:grid-cols-4"><div><p className="text-xl font-700 text-orange-700">{Number(localAnalytics.providerStats.requests_today || 0).toLocaleString()}</p><p className="text-xs text-gray-500">Requests today</p></div><div><p className="text-xl font-700 text-orange-700">{Number(localAnalytics.providerStats.requests_month || 0).toLocaleString()}</p><p className="text-xs text-gray-500">Requests this month</p></div><div><p className="text-xl font-700 text-orange-700">{Number(localAnalytics.providerStats.requests_limit || 0).toLocaleString()}</p><p className="text-xs text-gray-500">Monthly limit</p></div><div><p className="text-xl font-700 text-orange-700">{localAnalytics.providerStats.plan || "—"}</p><p className="text-xs text-gray-500">Plan</p></div></div></div>}

        {/* Partial errors */}
        {usage.partialErrors?.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-xs text-yellow-700">
            ⚠ Some data could not be loaded: {usage.partialErrors.join(" · ")}
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total Views" value={(usage.totalViews || 0).toLocaleString()} change={usage.timeframeLabel || "Your organisation"} icon={<Ic.trend />} />
          <StatCard label="Movie Views" value={(usage.totalMovieViews || 0).toLocaleString()} change={`${usage.topMovies?.length || 0} titles · ${usage.timeframeLabel || ""}`} icon={<Ic.film />} />
          <StatCard label="Series Views" value={(usage.totalSeriesViews || 0).toLocaleString()} change={`${usage.topSeries?.length || 0} titles · ${usage.timeframeLabel || ""}`} icon={<Ic.tv />} />
          <StatCard label="Tracked Items" value={(usage.topViewsCount || 0).toLocaleString()} change="Unique content" icon={<Ic.chart />} />
        </div>

        {/* Top viewed */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="font-700 text-gray-900">Top Viewed Content</h2>
              <p className="text-xs text-gray-400 mt-0.5">Live `view_count` from the Reelplexi account analytics API · <span className="text-orange-500 font-600">{TIMEFRAME_LABELS[timeframe]}</span></p>
            </div>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {(["all", "movies", "series"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 text-xs font-600 rounded-md capitalize transition-colors ${tab === t ? "bg-white text-orange-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr>
                  <Th>#</Th>
                  <Th>Title</Th>
                  <Th>VJ</Th>
                  <Th>Genre</Th>
                  <Th>Type</Th>
                  <Th>Views</Th>
                </tr>
              </thead>
              <tbody>
                {topViews.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No analytics data available yet.</td></tr>
                )}
                {topViews.map((item: any, i: number) => (
                  <tr key={`${item.id}-${i}`} className={`border-b border-gray-50 hover:bg-orange-50/20 transition-colors ${i % 2 === 1 ? "bg-gray-50/30" : ""}`}>
                    <Td className="text-gray-400 font-600 w-8">{i + 1}</Td>
                    <Td>
                      <div className="flex items-center gap-3">
                        {item.poster_url
                          ? <img src={item.poster_url} alt={item.title} className="w-9 h-12 rounded object-cover flex-shrink-0 bg-gray-100" />
                          : <div className="w-9 h-12 rounded bg-orange-50 flex items-center justify-center flex-shrink-0"><Ic.film /></div>
                        }
                        <span className="font-600 text-gray-800 truncate max-w-[180px]">{item.title}</span>
                      </div>
                    </Td>
                    <Td className="text-gray-500 text-xs">{item.vj}</Td>
                    <Td className="text-gray-500 text-xs">{item.genres?.[0] || "—"}</Td>
                    <Td>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-600 ${item.type === "movie" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                        {item.type === "movie" ? "Movie" : "Series"}
                      </span>
                    </Td>
                    <Td className="font-700 text-orange-600">{Number(item.views || 0).toLocaleString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </>)}
    </div>
  );
}

// ── Transactions Page ──────────────────────────────────────────────────────
function TransactionsPage() {
  const [identifier, setIdentifier] = useState("");
  const [status, setStatus] = useState("");
  const [provider, setProvider] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(30);
  const [hasMore, setHasMore] = useState(false);

  const fmtAmount = (tx: any) =>
    tx.amount != null ? `${Number(tx.amount).toLocaleString()} ${tx.currency || "UGX"}` : "—";

  const fmtDate = (iso: string) =>
    iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

  const statusBadge = (s: string) => {
    const v = (s || "").toLowerCase();
    if (v === "completed" || v === "success") return "bg-green-100 text-green-700";
    if (v === "pending" || v === "processing") return "bg-yellow-100 text-yellow-700";
    return "bg-red-100 text-red-500";
  };

  const lookup = async () => {
    if (!identifier.trim()) return;
    setLoading(true); setError(""); setRows([]);
    try {
      const data = await authedFetch<any>(`/api/transactions?identifier=${encodeURIComponent(identifier.trim())}`);
      setRows(data && data.id ? [data] : []);
      setHasMore(false);
      setLoaded(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Lookup failed"); }
    finally { setLoading(false); }
  };

  const loadHistory = async (limit = 30) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (status) params.set("status", status);
      if (provider) params.set("provider", provider);
      const data = await authedFetch<any[]>(`/api/transactions?${params}`);
      setRows(Array.isArray(data) ? data : []);
      setHistoryLimit(limit);
      setHasMore(Array.isArray(data) && data.length === limit);
      setLoaded(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load transactions"); }
    finally { setLoading(false); }
  };

  // Auto-load on mount
  React.useEffect(() => { loadHistory(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = () => loadHistory(historyLimit + 30);

  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-700 text-gray-900">Transactions</h1><p className="text-sm text-gray-400">Payment records from your Supabase database</p></div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <input
            className="flex-1 min-w-[220px] border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            placeholder="Reference UUID or provider transaction ID"
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            onKeyDown={e => e.key === "Enter" && lookup()}
          />
          <button onClick={lookup} disabled={loading} className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl px-5 py-2.5 text-sm font-600 transition-colors">
            {loading ? "Loading…" : "Lookup"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
            <option value="failed">Failed</option>
          </select>
          <select className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" value={provider} onChange={e => setProvider(e.target.value)}>
            <option value="">All providers</option>
            <option value="marzpay">MarzPay</option>
            <option value="yopayments">YoPayments</option>
            <option value="makypay">MakyPay</option>
          </select>
          <button onClick={() => loadHistory()} disabled={loading} className="border border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100 disabled:opacity-50 rounded-xl px-4 py-2 text-sm font-600 transition-colors">
            {loading ? "Loading…" : "Load history"}
          </button>
          {loaded && <span className="text-xs text-gray-400">{rows.length} record{rows.length !== 1 ? "s" : ""}</span>}
        </div>
        {error && <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
      </div>

      {/* Table */}
      {loaded && (
        <>
        <TableWrap>
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr>
                <Th>Reference</Th>
                <Th>Phone</Th>
                <Th>Provider</Th>
                <Th>Amount</Th>
                <Th>Date</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-sm text-gray-400">No transactions found.</td></tr>
              ) : rows.map((tx, i) => (
                <tr key={tx.id ?? i} className={`border-b border-gray-50 hover:bg-orange-50/30 transition-colors ${i % 2 === 1 ? "bg-gray-50/30" : ""}`}>
                  <Td className="font-mono text-xs text-gray-400 max-w-[180px] truncate">{tx.reference ?? tx.provider_transaction_id ?? String(tx.id)}</Td>
                  <Td className="text-gray-600">{tx.phone_number || "—"}</Td>
                  <Td className="text-gray-600 capitalize">{tx.provider || "—"}</Td>
                  <Td className="font-600 text-gray-900">{fmtAmount(tx)}</Td>
                  <Td className="text-gray-500 whitespace-nowrap">{fmtDate(tx.created_at)}</Td>
                  <Td>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-600 ${statusBadge(tx.status)}`}>
                      {tx.status ? tx.status.charAt(0).toUpperCase() + tx.status.slice(1) : "—"}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        {hasMore && <div className="flex justify-center mt-5"><button onClick={loadMore} disabled={loading} className="px-5 py-2.5 text-sm font-600 border border-orange-200 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-100 disabled:opacity-50">{loading ? "Loading…" : "Load more"}</button></div>}
        </>
      )}
    </div>
  );
}

// ── Notifications Page ─────────────────────────────────────────────────────
function NotificationsPage() {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editNotif, setEditNotif] = useState<Notification | null>(null);
  const nextId = () => Math.max(0, ...notifs.map(n => n.id)) + 1;

  const handleAdd = (n: Omit<Notification, "id">) => {
    setNotifs(p => [...p, { ...n, id: nextId() }]);
    setShowAdd(false);
  };
  const handleEdit = (n: Omit<Notification, "id">) => {
    setNotifs(p => p.map(x => x.id === editNotif!.id ? { ...x, ...n } : x));
    setEditNotif(null);
  };
  const handleSend = async (id: number) => {
    const notification = notifs.find(n => n.id === id);
    if (!notification) return;
    try {
      await authedFetch("/api/onesignal/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: notification.title, message: notification.message }) });
      setNotifs(p => p.map(n => n.id === id ? { ...n, status: "sent", sentAt: new Date().toLocaleString() } : n));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Notification failed");
    }
  };
  const handleDelete = (id: number) => {
    setNotifs(p => p.filter(n => n.id !== id));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-700 text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-400">{notifs.length} total notifications</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-600 px-4 py-2.5 rounded-xl transition-colors shadow-sm">
          <Ic.plus /> Add Notification
        </button>
      </div>
      <TableWrap>
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr>
              <Th>#</Th>
              <Th>Title</Th>
              <Th>Message</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {notifs.map((n, i) => (
              <tr key={n.id} className={`border-b border-gray-50 hover:bg-orange-50/30 transition-colors ${i % 2 === 1 ? "bg-gray-50/30" : ""}`}>
                <Td className="text-gray-400 font-mono">{i + 1}</Td>
                <Td className="font-500 text-gray-800 whitespace-nowrap">{n.title}</Td>
                <Td className="text-gray-500 max-w-xs">
                  <span className="truncate block" title={n.message}>
                    {n.message.length > 55 ? n.message.slice(0, 55) + "…" : n.message}
                  </span>
                  {n.sentAt && <span className="text-xs text-gray-400 block mt-0.5">Sent {n.sentAt}</span>}
                </Td>
                <Td>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-600 ${n.status === "sent" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {n.status === "sent" ? "Sent" : "Draft"}
                  </span>
                </Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSend(n.id)}
                      disabled={n.status === "sent"}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-600 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Ic.send /> Send
                    </button>
                    <button onClick={() => setEditNotif(n)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-600 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors">
                      <Ic.edit /> Edit
                    </button>
                    <button onClick={() => handleDelete(n.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-600 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors">
                      <Ic.trash /> Delete
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
            {notifs.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">No notifications yet. Click "+ Add Notification" to create one.</td></tr>}
          </tbody>
        </table>
      </TableWrap>
      {showAdd && <NotificationFormModal onClose={() => setShowAdd(false)} onSave={handleAdd} />}
      {editNotif && <NotificationFormModal existing={editNotif} onClose={() => setEditNotif(null)} onSave={handleEdit} />}
    </div>
  );
}

// ── Sidebar Nav ────────────────────────────────────────────────────────────
function SidebarNav({ page, setPage, onLogout, onClose }: { page: Page; setPage: (p: Page) => void; onLogout: () => void; onClose?: () => void }) {
  const go = (p: Page) => { setPage(p); onClose?.(); };
  const item = (p: Page, label: string, icon: React.ReactNode) => (
    <button key={p} onClick={() => go(p)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-500 transition-colors text-left ${page === p ? "bg-orange-500 text-white shadow-sm" : "text-gray-600 hover:bg-orange-50 hover:text-orange-600"}`}>
      {icon} {label}
    </button>
  );
  const section = (text: string) => <p className="text-xs font-600 text-gray-400 uppercase tracking-wider px-3 pt-5 pb-1">{text}</p>;

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-gray-100 flex items-center justify-between">
        <div>
          <span className="text-lg font-700 text-orange-500 leading-tight block">Kilax</span>
          <span className="text-xs font-500 text-gray-400 tracking-widest uppercase">Admin Panel</span>
        </div>
        {onClose && <button onClick={onClose} className="text-gray-400 hover:text-gray-600 lg:hidden p-1"><Ic.x /></button>}
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto sidebar-scroll">
        {item("dashboard", "Dashboard", <Ic.dashboard />)}
        {item("live-activity", "Live Activity", <Ic.trend />)}
        {section("Contents")}
        {item("movies", "Movies", <Ic.film />)}
        {item("series", "TV Series", <Ic.tv />)}
        {item("content-usage", "Content Usage", <Ic.chart />)}
        {section("User Management")}
        {item("users", "Users", <Ic.users />)}
        {item("subscriptions", "Subscriptions", <Ic.card />)}
        {item("plans", "Plans", <Ic.tag />)}
        {item("transactions", "Transactions", <Ic.card />)}
        {item("notifications", "Notifications", <Ic.bell />)}
      </nav>
      <div className="p-3 border-t border-gray-100">
        <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-500 text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors">
          <Ic.logout /> Logout
        </button>
      </div>
    </div>
  );
}

// ── Profile Dropdown ──────────────────────────────────────────────────────
function ProfileDropdown({ email, name, onLogout }: { email: string; name: string; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const initial = (name || email || "A").charAt(0).toUpperCase();

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      {/* Avatar trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-9 h-9 rounded-full bg-orange-500 text-white text-sm font-700 flex items-center justify-center flex-shrink-0 hover:bg-orange-600 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-1"
        aria-label="Profile menu"
      >
        {initial}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-11 w-72 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          {/* Profile header */}
          <div className="px-4 py-4 bg-gradient-to-br from-orange-50 to-white border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-orange-500 text-white text-lg font-700 flex items-center justify-center flex-shrink-0 shadow-sm">
                {initial}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-700 text-gray-900 truncate">{name || "Administrator"}</p>
                <p className="text-xs text-gray-400 truncate">{email}</p>
                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-600 rounded-full">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  Admin
                </span>
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div className="p-2">
            <button
              onClick={() => { setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors text-left"
            >
              <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </span>
              <div>
                <p className="font-500 text-gray-800 text-sm">Profile</p>
                <p className="text-xs text-gray-400">View account details</p>
              </div>
            </button>

            <div className="my-1.5 border-t border-gray-100" />

            <div className="px-3 py-2 space-y-1">
              <p className="text-xs font-600 text-gray-400 uppercase tracking-wider">Account</p>
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-gray-500">Email</span>
                <span className="text-xs font-500 text-gray-700 truncate max-w-[140px]">{email}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-gray-500">Role</span>
                <span className="text-xs font-600 text-orange-600">Administrator</span>
              </div>
            </div>

            <div className="my-1.5 border-t border-gray-100" />

            <button
              onClick={() => { setOpen(false); onLogout(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-500 hover:bg-red-50 transition-colors text-left"
            >
              <span className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </span>
              <div>
                <p className="font-600 text-sm">Sign Out</p>
                <p className="text-xs text-red-400">End your admin session</p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Login Page ─────────────────────────────────────────────────────────────
function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Please fill in all fields."); return; }
    setError("");
    try {
      const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password });
      if (error) throw error;
      onLogin();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid credentials.");
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-orange-50 via-white to-orange-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-orange-500 rounded-2xl shadow-lg mb-4">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
            </svg>
          </div>
          <h1 className="text-2xl font-700 text-gray-900">Kilax Admin Panel</h1>
          <p className="text-gray-400 text-sm mt-1">Sign in to your account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-600 text-gray-700 mb-1.5">Email Address</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                </span>
                <input type="email" className="w-full border border-gray-300 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all" placeholder="admin@kilax.com" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-600 text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </span>
                <input type={showPw ? "text" : "password"} className="w-full border border-gray-300 rounded-xl pl-10 pr-11 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPw ? <Ic.eyeOff /> : <Ic.eye />}
                </button>
              </div>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}
            <button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white font-600 py-3 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
              Sign In
            </button>
          </form>

          {/* Security note */}
          <div className="mt-5 pt-5 border-t border-gray-100 flex items-center justify-center gap-2 text-xs text-gray-400">
            <Ic.shield />
            <span>Only authorized administrators can access this panel</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── App Root ───────────────────────────────────────────────────────────────
export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const client = supabaseBrowser();
    client.auth.getSession().then(({ data }) => {
      setLoggedIn(!!data.session);
      if (data.session?.user) {
        setUserEmail(data.session.user.email || "");
        setUserName(
          data.session.user.user_metadata?.full_name ||
          data.session.user.user_metadata?.name ||
          ""
        );
      }
    }).finally(() => setAuthLoading(false));
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session);
      if (session?.user) {
        setUserEmail(session.user.email || "");
        setUserName(
          session.user.user_metadata?.full_name ||
          session.user.user_metadata?.name ||
          ""
        );
      } else {
        setUserEmail("");
        setUserName("");
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);
  const [page, setPage] = useState<Page>("dashboard");
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;
  if (!loggedIn) return <LoginPage onLogin={() => setLoggedIn(true)} />;

  const renderPage = () => {
    switch (page) {
      case "dashboard": return <DashboardPage />;
      case "live-activity": return <LiveActivityPage />;
      case "movies": return <ContentPage type="movie" />;
      case "series": return <ContentPage type="series" />;
      case "content-usage": return <ContentUsagePage />;
      case "users": return <UsersPage />;
      case "subscriptions": return <SubscriptionsPage />;
      case "plans": return <PlansPage />;
      case "transactions": return <TransactionsPage />;
      case "notifications": return <NotificationsPage />;
    }
  };

  return (
    <div className="flex h-full bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-56 bg-white border-r border-gray-100 flex-col h-full flex-shrink-0">
        <SidebarNav page={page} setPage={setPage} onLogout={async () => { await supabaseBrowser().auth.signOut(); setLoggedIn(false); }} />
      </aside>

      {/* Mobile backdrop */}
      {drawerOpen && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setDrawerOpen(false)} />}

      {/* Mobile drawer */}
      <aside className={`fixed top-0 left-0 h-full w-64 z-50 bg-white border-r border-gray-100 flex flex-col transform transition-transform duration-300 ease-in-out lg:hidden ${drawerOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`}>
        <SidebarNav page={page} setPage={setPage} onLogout={async () => { await supabaseBrowser().auth.signOut(); setLoggedIn(false); setDrawerOpen(false); }} onClose={() => setDrawerOpen(false)} />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <header className="bg-white border-b border-gray-100 px-4 lg:px-6 py-3.5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setDrawerOpen(true)} className="lg:hidden p-1.5 text-gray-500 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors">
              <Ic.menu />
            </button>
            <div className="hidden sm:block">
              <span className="text-base font-700 text-orange-500">Kilax</span>
              <span className="text-xs text-gray-400 ml-1">Admin Panel</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden md:block">Welcome, {userName || userEmail.split("@")[0] || "Administrator"}</span>
            <ProfileDropdown
              email={userEmail}
              name={userName}
              onLogout={async () => { await supabaseBrowser().auth.signOut(); setLoggedIn(false); }}
            />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
