"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";

import { signInWithEmail } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Search, Phone, Bell, X, ChevronLeft, ChevronRight, Plus, Check, Bookmark, Home, Film, Tv2, Heart, History, Smartphone, UserRound, Crown, Library, Flame, Sparkles, Clapperboard, Compass, Share2, Users, Gift, Link2, Play, Clapperboard as ClapperIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import OneSignalPrompt from "@/components/OneSignalPrompt";
import Footer from "@/components/Footer";
import RecaptchaGuard, { getRecaptchaToken } from "@/components/RecaptchaGuard";
import HomeVideoPlayer from "@/components/HomeVideoPlayer";
import { PhoneNumberField, PHONE_COUNTRIES, isValidInternationalPhone, normalizeInternationalPhone } from "@/components/PhoneNumberField";
import { isValidEmail, isValidPassword } from "@/lib/validation";
import type { AppNotification, AuthMode, Episode, LoginMethod, MediaItem, Page, UserProfile } from "@/lib/types/media";
import { useResponsive } from "@/hooks/useResponsive";
import { useCatalogLoader } from "@/hooks/useCatalogLoader";
import { useCatalogCollection } from "@/hooks/useCatalogCollection";
import { useNotifications } from "@/hooks/useNotifications";
import { AVATARS, BG, BLUE, CARD, DEFAULT_AVATAR, GREEN, ORANGE, SKYBLUE, VJS } from "@/lib/ui-config";
import { mapMediaItem } from "@/lib/media-normalizer";

// ─── Types ────────────────────────────────────────────────────────────────────
// ─── Constants ────────────────────────────────────────────────────────────────
// ─── Data ─────────────────────────────────────────────────────────────────────
// ─── Fallback catalog: empty — all content comes from Reelplexi ──────────────
// Do NOT add hardcoded TMDB IDs here. They conflict with Reelplexi's string
// IDs and cause phantom movie cards for content that isn't on the platform.
const allMedia: MediaItem[] = [];

// Hero slider IDs are populated dynamically from Reelplexi trending content.
// The old hardcoded list [1,2,101,107,13] used TMDB integers — removed.
const HERO_IDS: number[] = [];
const PAYMENT_HISTORY = [
  { id:1, date:"Jul 28, 2024", amount:"$9.99",  plan:"Standard", status:"Paid" },
  { id:2, date:"Jun 28, 2024", amount:"$9.99",  plan:"Standard", status:"Paid" },
  { id:3, date:"May 28, 2024", amount:"$4.99",  plan:"Basic",    status:"Paid" },
];
// ─── Helpers ──────────────────────────────────────────────────────────────────
let mediaCatalog: MediaItem[] = [];
const getMediaCatalog = () => mediaCatalog;
const byId = (id: number) => mediaCatalog.find(m => m.id === id)!;

const mapReelplexiItem = mapMediaItem;


const inputSt: React.CSSProperties = {
  width:"100%", padding:"13px 16px",
  background:"rgba(255,255,255,0.06)",
  border:"1px solid rgba(255,255,255,0.1)",
  borderRadius:12, color:"white", fontSize:14,
  fontFamily:"'DM Sans',sans-serif", outline:"none",
  boxSizing:"border-box", transition:"border 0.2s, box-shadow 0.2s",
};

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ emoji, bg, size=40, ring=false }: { emoji:string; bg:string; size?:number; ring?:boolean }) {
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:bg, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.44, boxShadow:ring?`0 0 0 3px rgba(59,130,246,0.5),0 0 0 5px rgba(59,130,246,0.15)`:"0 4px 16px rgba(0,0,0,0.4)" }}>{emoji}</div>
  );
}

function AvatarPicker({ selected, onSelect }: { selected:number; onSelect:(i:number)=>void }) {
  return (
    <div>
      <p style={{ color:"#64748b", fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:12 }}>Choose Your Avatar</p>
      <div style={{ display:"flex", gap:8, justifyContent:"space-between" }}>
        {AVATARS.map((av,i) => (
          <button key={i} onClick={()=>onSelect(i)} style={{ background:"none", border:"none", cursor:"pointer", padding:0, flex:1, display:"flex", justifyContent:"center" }}>
            <div style={{ width:38, height:38, borderRadius:"50%", background:av.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, outline:selected===i?`2px solid ${BLUE}`:"2px solid transparent", outlineOffset:3, boxShadow:selected===i?`0 0 0 4px rgba(59,130,246,0.2)`:"none", transform:selected===i?"scale(1.12)":"scale(1)", transition:"all 0.18s" }}>{av.emoji}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function LoadingBars({ label, compact=false }: { label?:string; compact?:boolean }) {
  return <div className={compact?"loading-bars loading-bars-compact":"loading-bars"} role="status" aria-label={label || "Loading"}>
    <div className="loading-bars-track">{Array.from({length:8},(_,i)=><span key={i} style={{animationDelay:`${i*0.08}s`}} />)}</div>
    {label && <span className="loading-bars-label">{label}</span>}
  </div>;
}

function WhatsAppIcon({ size=24 }: { size?:number }) {
  return <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" fill="currentColor"><path d="M16 3.5A12.5 12.5 0 0 0 5.17 22.2L3.5 28.5l6.52-1.61A12.5 12.5 0 1 0 16 3.5Zm0 22.7c-1.86 0-3.68-.5-5.27-1.45l-.38-.23-3.87.96 1-3.75-.25-.39A9.95 9.95 0 1 1 16 26.2Zm5.47-7.37c-.3-.15-1.77-.87-2.05-.97-.28-.1-.48-.15-.68.15-.2.3-.78.97-.96 1.17-.18.2-.35.22-.65.08-.3-.15-1.26-.46-2.4-1.47-.89-.79-1.49-1.77-1.67-2.07-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.08-.15-.68-1.64-.93-2.25-.25-.6-.5-.52-.68-.53h-.58c-.2 0-.52.08-.8.38-.28.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.09 4.49.71.31 1.26.5 1.69.64.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.18-1.42-.08-.13-.28-.2-.58-.35Z"/></svg>;
}

// ─── Atoms ────────────────────────────────────────────────────────────────────
function RatingBadge({ r }: { r:string }) {
  return <span style={{ border:"1px solid rgba(255,255,255,0.18)", borderRadius:5, fontSize:10, padding:"2px 7px", color:"#94a3b8", fontWeight:600, flexShrink:0 }}>{r}</span>;
}

function StarRating({ score }: { score:number }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:3 }}>
      <span style={{ color:"#f59e0b", fontSize:12, lineHeight:1 }}>★</span>
      <span style={{ color:"#94a3b8", fontSize:11 }}>{score.toFixed(1)}</span>
    </span>
  );
}

function BlueBtn({ children, onClick, style }: { children:React.ReactNode; onClick?:()=>void; style?:React.CSSProperties }) {
  return (
    <button onClick={onClick} style={{ background:`linear-gradient(135deg,${BLUE},#1d4ed8)`, color:"white", fontWeight:700, borderRadius:12, padding:"12px 28px", fontSize:14, border:"none", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", display:"flex", alignItems:"center", gap:8, transition:"opacity 0.18s", ...style }} onMouseEnter={e=>(e.currentTarget.style.opacity="0.85")} onMouseLeave={e=>(e.currentTarget.style.opacity="1")}>{children}</button>
  );
}
function PrimaryBtn({ children, onClick, style }: { children:React.ReactNode; onClick?:()=>void; style?:React.CSSProperties }) {
  return (
    <button onClick={onClick} style={{ background:"white", color:"#050709", fontWeight:700, borderRadius:12, padding:"12px 28px", fontSize:14, border:"none", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", display:"flex", alignItems:"center", gap:8, transition:"opacity 0.18s", ...style }} onMouseEnter={e=>(e.currentTarget.style.opacity="0.88")} onMouseLeave={e=>(e.currentTarget.style.opacity="1")}>{children}</button>
  );
}

type Trailer = { key:string; site?:string; type?:string; name?:string };

function ExpandableStoryline({ text, mobile }: { text:string; mobile:boolean }) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = text.length > 220;
    return <div style={{ marginBottom:4 }}><p style={{ color:"#cbd5e1", fontSize:mobile?13:14, lineHeight:1.65, margin:0, display:"-webkit-box", WebkitBoxOrient:"vertical", WebkitLineClamp:expanded?"unset":3, overflow:expanded?"visible":"hidden" }}>{text}</p>{canExpand&&<button onClick={()=>setExpanded(value=>!value)} style={{ background:"none", border:0, color:"#93c5fd", padding:"5px 0 0", fontSize:12, fontWeight:700, cursor:"pointer" }}>{expanded?"See less":"See more"}</button>}</div>;
}

function TrailerButton({ item, style }: { item:MediaItem; style?:React.CSSProperties }) {
  const [trailers, setTrailers] = useState<Trailer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const sourceId = item.sourceId || String(item.id);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/reelplexi/trailers?id=${encodeURIComponent(sourceId)}&type=${item.type}`, { cache:"no-store" })
      .then(response => response.ok ? response.json() : { trailers:[] })
      .then(data => { if (!cancelled) setTrailers(Array.isArray(data.trailers) ? data.trailers : []); })
      .catch(() => { if (!cancelled) setTrailers([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sourceId]);

  const trailer = trailers[0];
  return <>
    <button onClick={() => trailer && setOpen(true)} disabled={loading || !trailer} aria-label={loading ? "Loading trailer" : trailer ? "Play trailer" : "Trailer unavailable"} style={{ ...style, opacity:loading || !trailer ? 0.5 : 1, cursor:loading || !trailer ? "default" : "pointer" }}>
      <Play size={14} fill="currentColor" /> {loading ? "Loading trailer..." : "Play Trailer"}
    </button>
    {open && trailer && <div onClick={() => setOpen(false)} style={{ position:"fixed", inset:0, zIndex:240, background:"rgba(0,0,0,.9)", display:"grid", placeItems:"center", padding:24 }}>
      <div onClick={event => event.stopPropagation()} style={{ width:"100%", maxWidth:900, position:"relative" }}>
        <button onClick={() => setOpen(false)} aria-label="Close trailer" style={{ position:"absolute", top:-42, right:0, background:"none", border:0, color:"white", cursor:"pointer" }}><X size={24}/></button>
        <div style={{ aspectRatio:"16 / 9", background:"black" }}><iframe src={`https://www.youtube.com/embed/${encodeURIComponent(trailer.key)}?autoplay=1&rel=0`} title={trailer.name || `${item.title} trailer`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen style={{ width:"100%", height:"100%", border:0 }} /></div>
        {trailer.name && <p style={{ color:"white", margin:"10px 0 0", fontSize:13 }}>{trailer.name}</p>}
      </div>
    </div>}
  </>;
}
function GlassBtn({ children, onClick, style }: { children:React.ReactNode; onClick?:()=>void; style?:React.CSSProperties }) {
  const label = children === "All Episodes" ? "View Episodes" : children;
  return (
    <button onClick={onClick} style={{ background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.13)", color:"white", borderRadius:12, padding:"12px 24px", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", display:"flex", alignItems:"center", gap:8, transition:"all 0.2s", ...style }} onMouseEnter={e=>(e.currentTarget.style.background="rgba(255,255,255,0.13)")} onMouseLeave={e=>(e.currentTarget.style.background="rgba(255,255,255,0.07)")}>{label}</button>
  );
}
function Pill({ children, active, color=BLUE, onClick }: { children:React.ReactNode; active?:boolean; color?:string; onClick?:()=>void }) {
  return (
    <button onClick={onClick} style={{ padding:"6px 16px", borderRadius:20, fontSize:12, fontWeight:600, cursor:"pointer", background:active?color:"rgba(255,255,255,0.05)", color:active?"white":"#94a3b8", border:`1px solid ${active?color:"rgba(255,255,255,0.08)"}`, transition:"all 0.18s", fontFamily:"'DM Sans',sans-serif" }}>{children}</button>
  );
}

// ─── Logo ─────────────────────────────────────────────────────────────────────
function KilaxLogo({ height=36 }: { height?:number }) {
  return (
    <div style={{ display:"inline-flex", alignItems:"center", gap:9 }}>
      <div style={{ background:"white", borderRadius:8, padding:"4px 10px", display:"inline-flex", alignItems:"center", boxShadow:"0 2px 12px rgba(0,0,0,0.35)" }}>
        <img src="/logo.png" alt="Kilax Movies" style={{ height, objectFit:"contain", display:"block" }} />
      </div>
      <span style={{ color:"white", fontWeight:800, fontSize:height<=30?15:18, letterSpacing:"-.02em", whiteSpace:"nowrap" }}>Kilax Movies</span>
    </div>
  );
}

// ─── Auth Modal ───────────────────────────────────────────────────────────────
function AuthModal({ initialMode, onSuccess, onClose }: { initialMode:AuthMode; onSuccess:(u:UserProfile)=>void; onClose:()=>void }) {
  const { mobile } = useResponsive();
  const [mode,      setMode     ] = useState<AuthMode>(initialMode);
  const [method,    setMethod   ] = useState<LoginMethod>("email");
  const [name,      setName     ] = useState("");
  const [email,     setEmail    ] = useState("");
  const [countryCode, setCountryCode] = useState("UG");
  const [phone,     setPhone    ] = useState("");
  const [pass,      setPass     ] = useState("");
  const [confirm,   setConfirm  ] = useState("");
  const [avatarIdx, setAvatarIdx] = useState(0);

  const submit = async () => {
    const av = AVATARS[avatarIdx];
    if (!isValidPassword(pass)) { alert("Password must be at least 6 characters."); return; }
    const selectedCountry = PHONE_COUNTRIES.find(c => c.code === countryCode);
    if (isSignup) {
      if (!selectedCountry || !isValidInternationalPhone(selectedCountry.dialCode, phone)) {
        alert("Please enter a valid phone number with the country code.");
        return;
      }
    }
    if (method === "email" && !isValidEmail(email)) {
      alert("Please enter a valid email address, for example samplemail@gmail.com.");
      return;
    }
    if (isSignup && pass !== confirm) { alert("Passwords do not match."); return; }
    try {
      const captcha = await getRecaptchaToken(isSignup ? "signup" : "login");
      if (captcha) {
        const verifyRes = await fetch("/api/security/recaptcha", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ token:captcha, action:isSignup?"signup":"login", accountId:email.trim().toLowerCase(), email:email.trim().toLowerCase() }) });
        const verifyData = await verifyRes.json();
        if (!verifyData.ok) throw new Error(verifyData.error || "Security verification failed. Please try again.");
      }
      const normalizedPhone = selectedCountry ? normalizeInternationalPhone(selectedCountry.dialCode, phone) : "";
      if (mode === "signup") {
        const result = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password: pass, options: { data: { phone: normalizedPhone } } });
        if (result.error) { alert(result.error.message); return; }
        const authUser = result.data.user;
        onSuccess({ name:name || authUser?.user_metadata?.full_name || "Kilax Viewer", email:authUser?.email || email, phone:normalizedPhone||authUser?.user_metadata?.phone||"", joinDate:new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}), avatar:av.emoji, avatarBg:av.bg });
        return;
      }

      const result = await signInWithEmail(email.trim().toLowerCase(), pass);
      if (!result.success) { alert(result.error || "Authentication failed"); return; }
      const { data: { user: authUser } } = await supabase.auth.getUser();
      onSuccess({ name:name || authUser?.user_metadata?.full_name || "Kilax Viewer", email:authUser?.email || email, phone:normalizedPhone||authUser?.user_metadata?.phone||"", joinDate:new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}), avatar:av.emoji, avatarBg:av.bg });
    } catch (e) { alert(e instanceof Error ? e.message : "Authentication failed"); }
  };
  const isSignup = mode === "signup";
  const wideModal = isSignup && !mobile;

  const formContent = (
    <div style={{ padding:mobile?"24px 20px 28px":wideModal?"36px 36px 36px":"36px 40px 40px", flex:1 }}>
      {!wideModal && (
        <div style={{ display:"flex", justifyContent:"center", marginBottom:24 }}>
          <KilaxLogo height={44} />
        </div>
      )}
      <h2 style={{ color:"white", fontSize:mobile?18:22, fontWeight:700, marginBottom:4, textAlign:wideModal?"left":"center" }}>
        {isSignup ? "Create your account" : "Welcome back"}
      </h2>
      <p style={{ color:"#475569", fontSize:13, marginBottom:24, textAlign:wideModal?"left":"center" }}>
        {isSignup ? "Join millions of viewers on Kilax" : "Log in to continue streaming"}
      </p>
      {isSignup && mobile && (
        <div style={{ marginBottom:20 }}>
          <AvatarPicker selected={avatarIdx} onSelect={setAvatarIdx} />
        </div>
      )}
      {!isSignup && (
        <div style={{ display:"flex", borderBottom:"1px solid rgba(255,255,255,0.07)", marginBottom:20 }}>
          <button style={{ flex:1, padding:"9px 0", background:"none", border:"none", cursor:"default", fontFamily:"'DM Sans',sans-serif", fontSize:13, fontWeight:600, color:"white", borderBottom:`2px solid ${BLUE}` }}>
            Email
          </button>
        </div>
      )}
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {isSignup && <input value={name} onChange={e=>setName(e.target.value)} placeholder="Full Name" style={inputSt} />}
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="samplemail@gmail.com" type="email" style={inputSt} />
        {isSignup && (
          <div style={{display:"flex", flexDirection:"column", gap:6}}>
            <PhoneNumberField countryCode={countryCode} phone={phone} onCountryChange={setCountryCode} onPhoneChange={setPhone} />
          </div>
        )}
        <input value={pass} onChange={e=>setPass(e.target.value)} placeholder="Password" type="password" style={inputSt} />
        {isSignup && <input value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Confirm password" type="password" style={inputSt} />}
      </div>
      {!isSignup && (
        <div style={{ textAlign:"right", marginTop:10 }}>
          <button type="button" onClick={()=>{ window.location.href="/forgot-password" }} style={{ background:"none", border:"none", color:BLUE, fontSize:12, cursor:"pointer" }}>Forgot password?</button>
        </div>
      )}
      <BlueBtn onClick={submit} style={{ width:"100%", marginTop:22, justifyContent:"center" }}>
        {isSignup ? "Create Account" : "Log In"}
      </BlueBtn>
      <button onClick={async()=>{ try { const captcha=await getRecaptchaToken(isSignup?"signup_google":"login_google"); if(captcha){ const v=await fetch("/api/security/recaptcha",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:captcha,action:isSignup?"signup_google":"login_google"})}); if(!v.ok) throw new Error("Security verification failed"); } const {error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:`${window.location.origin}/auth/callback`}}); if(error) alert(error.message); } catch(e){ alert(e instanceof Error?e.message:"Google authentication failed"); } }} style={{ width:"100%", marginTop:10, padding:"11px 18px", borderRadius:12, background:"rgba(255,255,255,.06)", border:"1px solid rgba(255,255,255,.12)", color:"white", fontWeight:700, cursor:"pointer" }}>Continue with Google</button>
      <div style={{ textAlign:"center", marginTop:20, paddingTop:18, borderTop:"1px solid rgba(255,255,255,0.06)" }}>
        <span style={{ color:"#475569", fontSize:13 }}>{isSignup ? "Already have an account? " : "New to Kilax? "}</span>
        <button onClick={()=>setMode(isSignup?"login":"signup")} style={{ background:"none", border:"none", color:ORANGE, fontSize:13, fontWeight:700, cursor:"pointer" }}>
          {isSignup ? "Log in" : "Create account"}
        </button>
      </div>
    </div>
  );

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:80, background:"rgba(3,5,12,0.78)", backdropFilter:"blur(20px)", display:"flex", alignItems:"center", justifyContent:"center", padding:mobile?12:24 }}>
      <div onClick={e=>e.stopPropagation()} className="modal-glass fade-up" style={{
        borderRadius:22, width:"100%", maxWidth:wideModal?720:460,
        border:"1px solid rgba(255,255,255,0.12)",
        boxShadow:"0 48px 120px rgba(0,0,0,0.7), 0 0 0 1px rgba(59,130,246,0.08), inset 0 1px 0 rgba(255,255,255,0.08)",
        overflow:"hidden", display:"flex", position:"relative",
      }}>
        <div style={{ height:3, background:`linear-gradient(90deg,${BLUE},${ORANGE})`, position:"absolute", top:0, left:0, right:0, zIndex:1 }} />
        {wideModal && (
          <div style={{ width:"42%", background:`linear-gradient(160deg,rgba(59,130,246,0.18) 0%,rgba(249,115,22,0.09) 100%)`, borderRight:"1px solid rgba(255,255,255,0.08)", padding:"40px 28px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:24 }}>
            <KilaxLogo height={52} />
            <p style={{ color:"#64748b", fontSize:13, textAlign:"center", lineHeight:1.75 }}>
              Stream thousands of movies and series with your favourite VJ narrations — anytime, anywhere.
            </p>
            <div style={{ width:"100%" }}>
              <AvatarPicker selected={avatarIdx} onSelect={setAvatarIdx} />
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", justifyContent:"center" }}>
              {["Movies","Series","VJ Audio","Downloads"].map(t=>(
                <span key={t} style={{ fontSize:11, color:"#475569", border:"1px solid rgba(255,255,255,0.07)", borderRadius:20, padding:"4px 12px" }}>{t}</span>
              ))}
            </div>
          </div>
        )}
        {formContent}
      </div>
    </div>
  );
}

// ─── Payment Method Modal ─────────────────────────────────────────────────────
function PaymentMethodModal({ onSelect, onClose }: { onSelect:(method:string)=>void; onClose:()=>void }) {
  const { mobile } = useResponsive();
  const [chosen, setChosen] = useState<string|null>(null);
  const methods = [
    { id:"mobilemoney", label:"Mobile Money", desc:"MTN, Airtel, Vodacom", icon:"📱", color:"#f59e0b" },
    { id:"visa",        label:"Visa / Mastercard", desc:"Credit or Debit Card", icon:"💳", color:"#3b82f6" },
  ];
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:90, background:"rgba(3,5,12,0.88)", backdropFilter:"blur(20px)", display:"flex", alignItems:"center", justifyContent:"center", padding:mobile?12:24 }}>
      <div onClick={e=>e.stopPropagation()} className="fade-up" style={{ background:CARD, borderRadius:22, width:"100%", maxWidth:420, border:"1px solid rgba(255,255,255,0.08)", boxShadow:"0 48px 120px rgba(0,0,0,0.8)", overflow:"hidden" }}>
        <div style={{ height:3, background:`linear-gradient(90deg,${SKYBLUE},${ORANGE})` }} />
        <div style={{ padding:mobile?"24px 20px 28px":"32px 36px 36px" }}>
          <h2 style={{ color:"white", fontSize:20, fontWeight:700, marginBottom:6 }}>Payment Method</h2>
          <p style={{ color:"#64748b", fontSize:13, marginBottom:24 }}>How would you like to pay for your plan?</p>
          <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:24 }}>
            {methods.map(m=>(
              <button key={m.id} type="button" aria-pressed={chosen===m.id} onClick={()=>setChosen(m.id)} style={{ display:"flex", alignItems:"center", gap:16, padding:"16px 18px", borderRadius:14, border:`2px solid ${chosen===m.id?m.color:"rgba(255,255,255,0.07)"}`, background:chosen===m.id?`rgba(${m.id==="mobilemoney"?"245,158,11":"59,130,246"},0.08)`:"rgba(255,255,255,0.02)", cursor:"pointer", transition:"all 0.2s", textAlign:"left" }}>
                <span style={{ fontSize:28 }}>{m.icon}</span>
                <div>
                  <p style={{ color:"white", fontWeight:700, fontSize:14, margin:0 }}>{m.label}</p>
                  <p style={{ color:"#64748b", fontSize:12, margin:0 }}>{m.desc}</p>
                </div>
                <div style={{ marginLeft:"auto", width:20, height:20, borderRadius:"50%", border:`2px solid ${chosen===m.id?m.color:"rgba(255,255,255,0.2)"}`, background:chosen===m.id?m.color:"transparent", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {chosen===m.id && <div style={{ width:8, height:8, borderRadius:"50%", background:"white" }} />}
                </div>
              </button>
            ))}
          </div>
          <BlueBtn onClick={()=>{ if(chosen) onSelect(chosen); }} style={{ width:"100%", justifyContent:"center", opacity:chosen?1:0.45 }}>Continue</BlueBtn>
          <button onClick={onClose} style={{ width:"100%", marginTop:8, padding:"11px", background:"transparent", color:"#475569", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, fontSize:13, cursor:"pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Premium Paywall ──────────────────────────────────────────────────────────
function PremiumPaywall({ item, onClose, onUpgrade, action="play" }: { item:MediaItem; onClose:()=>void; onUpgrade:()=>void; action?:"play"|"download" }) {
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:75, background:"rgba(3,5,12,0.82)", backdropFilter:"blur(20px)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div onClick={e=>e.stopPropagation()} className="modal-glass fade-up" style={{ borderRadius:22, width:"100%", maxWidth:420, overflow:"hidden", border:"1px solid rgba(249,115,22,0.2)", boxShadow:"0 48px 120px rgba(0,0,0,0.8)", position:"relative" }}>
        <div style={{ height:3, background:`linear-gradient(90deg,${ORANGE},${BLUE})`, position:"absolute", top:0, left:0, right:0 }} />
        <div style={{ padding:"40px 40px 36px", textAlign:"center" }}>
          <div style={{ width:68, height:68, borderRadius:"50%", background:"rgba(249,115,22,0.1)", border:"1px solid rgba(249,115,22,0.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:30, margin:"0 auto 22px" }}>👑</div>
          <h2 style={{ color:"white", fontSize:22, fontWeight:700, marginBottom:10 }}>{action === "download" ? "Downloads require Standard or Pro" : "Standard Content"}</h2>
          <p style={{ color:"#64748b", fontSize:14, lineHeight:1.75, marginBottom:28 }}>
            <span style={{ color:ORANGE, fontWeight:600 }}>{item.title}</span> {action === "download" ? "can only be downloaded on a Standard or Go Pro package. Upgrade your plan to unlock downloads." : "is available with a Standard package. Upgrade to unlock thousands of titles."}
          </p>
          <BlueBtn onClick={onUpgrade} style={{ width:"100%", justifyContent:"center", marginBottom:10 }}>View Plans</BlueBtn>
          <button onClick={onClose} style={{ width:"100%", padding:"12px", background:"transparent", color:"#475569", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, fontSize:13, cursor:"pointer" }}>Maybe Later</button>
        </div>
      </div>
    </div>
  );
}

function FreeAllowanceLimitModal({ onClose, onUpgrade }: { onClose:()=>void; onUpgrade:()=>void }) {
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:220, background:"rgba(3,5,12,0.82)", backdropFilter:"blur(20px)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div onClick={e=>e.stopPropagation()} className="modal-glass fade-up" style={{ borderRadius:22, width:"100%", maxWidth:420, overflow:"hidden", border:"1px solid rgba(249,115,22,0.2)", boxShadow:"0 48px 120px rgba(0,0,0,0.8)" }}>
        <div style={{ padding:"40px 40px 36px", textAlign:"center" }}>
          <div style={{ width:68, height:68, borderRadius:"50%", background:"rgba(249,115,22,0.1)", border:"1px solid rgba(249,115,22,0.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:30, margin:"0 auto 22px" }}>⏱</div>
          <h2 style={{ color:"white", fontSize:22, fontWeight:700, marginBottom:10 }}>Streaming limit reached</h2>
          <p style={{ color:"#64748b", fontSize:14, lineHeight:1.75, marginBottom:28 }}>Your free stream limit has been reached. View plans to continue watching or go back to browse more titles.</p>
          <BlueBtn onClick={onUpgrade} style={{ width:"100%", justifyContent:"center", marginBottom:10 }}>View Plans</BlueBtn>
          <button onClick={onClose} style={{ width:"100%", padding:"12px", background:"transparent", color:"#475569", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, fontSize:13, cursor:"pointer" }}>Back</button>
        </div>
      </div>
    </div>
  );
}

// ─── Series Detail Page ───────────────────────────────────────────────────────
function SeriesDetailPage({ series, onClose, onWatch }: { series:MediaItem; onClose:()=>void; onWatch:(epIdx:number)=>void }) {
  const { mobile, tablet } = useResponsive();
  const seriesScore = Number(series.score || 0);
    const seriesYear = series.year;
  const seriesStory = series.description || "Storyline unavailable.";
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [activeSeason, setActiveSeason] = useState(1);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setEpisodesLoading(true);
        const response = await fetch(`/api/reelplexi/series/${encodeURIComponent(series.sourceId || String(series.id))}/episodes?season=${activeSeason}`, { cache: "force-cache" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Episode request failed");
        const mapped = (payload.episodes || []).map((ep: any) => ({
          season: activeSeason, ep: Number(ep.episode_number), title: ep.title || ep.name || `Episode ${ep.episode_number}`,
          duration: ep.runtime ? `${ep.runtime}m` : "", description: ep.overview || ep.description || "",
          thumbnail: ep.thumbnail_url || ep.poster_url || series.image,
          videoUrl: ep.embed_url || ep.video_url || ep.stream_url || "",
        }));
        if (!cancelled) setEpisodes(mapped);
      } catch (error) { console.error("Reelplexi episodes failed:", error); if (!cancelled) setEpisodes([]); } finally { if (!cancelled) setEpisodesLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [series.sourceId, series.id, series.image, activeSeason]);
  const seasons = useMemo(()=>Array.from({length: Math.max(1, series.seasons || 1)}, (_,i)=>i+1),[series.seasons]);
  const [downloading,  setDownloading ] = useState<number|null>(null);
  const [canDownload, setCanDownload] = useState(false);
  useEffect(()=>{(async()=>{try{const {data:{session}}=await supabase.auth.getSession();if(session?.access_token){const r=await fetch("/api/subscription/status",{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});if(r.ok){const d=await r.json();setCanDownload(!!d.canDownload)}}}catch{}})()},[]);
  const px = mobile ? 16 : tablet ? 32 : 48;
  const vjName = series.vj || "VJ";
  const genres = series.genres.filter((genre) => genre.toLowerCase() !== 'musical');

  const filteredEps = episodes.filter(e=>e.season===activeSeason);

  return (
    <div style={{ position:"fixed", inset:0, zIndex:70, background:BG, overflowY:"auto", paddingTop:`env(safe-area-inset-top,0px)` }}>
      <div style={{ position:"relative", height:mobile?"42vh":"52vh", minHeight:300, overflow:"hidden" }}>
        <img src={series.heroImage||series.image} alt={series.title} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(to right,rgba(13,17,23,0.97) 0%,rgba(13,17,23,0.55) 55%,rgba(13,17,23,0.08) 100%)" }} />
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top,#0d1117 0%,transparent 50%)" }} />
        <button onClick={onClose} style={{ position:"absolute", top:mobile?16:24, left:mobile?16:48, background:"rgba(13,17,23,0.72)", backdropFilter:"blur(12px)", border:"1px solid rgba(255,255,255,0.12)", color:"white", borderRadius:10, padding:"9px 18px", fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", gap:8, fontFamily:"'DM Sans',sans-serif" }}>← Back</button>
        <div style={{ position:"absolute", bottom:mobile?20:36, left:mobile?16:48, right:mobile?16:48, maxWidth:560 }}>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:12 }}>
            <span style={{ background:"rgba(59,130,246,0.88)", color:"#fff", fontSize:9, fontWeight:800, padding:"3px 10px", borderRadius:6 }}>SERIES</span>
            
            <StarRating score={seriesScore} /><span style={{color:"#94a3b8",fontSize:12}}>{seriesYear}</span>
          </div>
          <h1 style={{ fontFamily:"'Anton',sans-serif", fontSize:mobile?30:48, color:"white", lineHeight:0.95, marginBottom:14, letterSpacing:"0.01em" }}>{series.title}</h1>
          <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginBottom:14, fontSize:13, alignItems:"center" }}>
            <StarRating score={seriesScore} />
            <span style={{ color:"#94a3b8" }}>{seriesYear}</span>
            <span style={{ color:"#94a3b8" }}>{series.seasons} Season{series.seasons!==1?"s":""}</span>
            <span style={{ color:"#94a3b8" }}>{series.episodes} Episodes</span>
          </div>
          <p style={{ color:"#94a3b8", fontSize:13, lineHeight:1.72, marginBottom:10 }} className="clamp-2">{seriesStory}</p>
          <p style={{ color:ORANGE, fontSize:12, fontWeight:600, marginBottom:16 }}>VJ: {vjName}</p>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:16 }}>
            {genres.map((genre) => <span key={genre} style={{ color:"#bfdbfe", background:"rgba(59,130,246,.14)", border:"1px solid rgba(96,165,250,.25)", borderRadius:999, padding:"4px 9px", fontSize:11 }}>{genre}</span>)}
          </div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                <PrimaryBtn onClick={()=>onWatch(0)} style={{ fontSize:13, padding:"10px 22px" }}>Play from Start</PrimaryBtn>
                <TrailerButton item={series} style={{ background:"rgba(255,255,255,.08)", border:"1px solid rgba(255,255,255,.16)", color:"white", borderRadius:12, padding:"10px 18px", fontSize:13, fontWeight:700, display:"flex", alignItems:"center", gap:7 }} />
              </div>
        </div>
      </div>

      <div style={{ padding:`24px ${px}px 0`, maxWidth:1100, margin:"0 auto", width:"100%", boxSizing:"border-box" }}>
        {seasons.length > 1 && (
              <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:14 }}>
            {seasons.map(s=>(
              <button key={s} onClick={()=>setActiveSeason(s)} style={{ padding:"9px 22px", borderRadius:10, fontSize:13, fontWeight:600, cursor:"pointer", background:activeSeason===s?BLUE:"rgba(255,255,255,0.06)", color:activeSeason===s?"white":"#64748b", border:`1px solid ${activeSeason===s?BLUE:"rgba(255,255,255,0.08)"}`, fontFamily:"'DM Sans',sans-serif", transition:"all 0.2s" }}>Season {s}</button>
            ))}
          </div>
        )}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}><p style={{ color:"#475569", fontSize:13, margin:0 }}>{filteredEps.length} episode{filteredEps.length!==1?"s":""} · Season {activeSeason}</p>{episodesLoading && <LoadingBars compact label="" />}</div>
        <div style={{ display:"flex", flexDirection:"column", gap:12, paddingBottom:60 }}>
          {filteredEps.map((ep,i)=>{
            const globalIdx = episodes.findIndex(e=>e.season===ep.season&&e.ep===ep.ep);
            const dlKey = ep.season*100+ep.ep;
            return (
              <div key={i} style={{ display:"flex", gap:mobile?10:18, alignItems:mobile?"flex-start":"center", background:CARD, border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:mobile?"12px":"16px 20px", transition:"border-color 0.2s" }}
                onMouseEnter={e=>(e.currentTarget.style.borderColor="rgba(59,130,246,0.3)")}
                onMouseLeave={e=>(e.currentTarget.style.borderColor="rgba(255,255,255,0.06)")}
              >
                <div style={{ position:"relative", flexShrink:0, cursor:"pointer" }} onClick={()=>onWatch(globalIdx)}>
                  <img src={ep.thumbnail} alt={ep.title} style={{ width:mobile?110:160, height:mobile?62:90, objectFit:"cover", borderRadius:9, display:"block" }} />
                  <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.38)", borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <div style={{ width:34, height:34, borderRadius:"50%", background:"rgba(255,255,255,0.18)", backdropFilter:"blur(6px)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>&#9654;</div>
                  </div>
                  <span style={{ position:"absolute", bottom:5, right:6, background:"rgba(0,0,0,0.78)", color:"white", fontSize:9, padding:"2px 5px", borderRadius:4 }}>{ep.duration}</span>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ color:"#475569", fontSize:10, fontWeight:700, marginBottom:3 }}>S{ep.season} E{ep.ep}</p>
                  <p style={{ color:"white", fontSize:mobile?13:15, fontWeight:600, marginBottom:mobile?0:5 }}>{ep.title}</p>
                  {!mobile && <p style={{ color:"#64748b", fontSize:13, lineHeight:1.6 }} className="clamp-2">{ep.description}</p>}
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:8, flexShrink:0 }}>
                  <button onClick={()=>onWatch(globalIdx)} style={{ background:BLUE, color:"white", border:"none", borderRadius:9, padding:mobile?"8px 12px":"9px 18px", fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>Play</button>
                  <button onClick={async()=>{ if(!canDownload){alert("Downloads are available on Standard and Pro packages. Please choose a qualifying package to download this title.");window.dispatchEvent(new Event("kilax-open-subscription"));return;} setDownloading(dlKey); try{const {data:{session}}=await supabase.auth.getSession(); if(!session?.access_token) throw new Error("Please sign in first"); const params=new URLSearchParams({id:series.sourceId||String(series.id),type:"episode",season:String(ep.season),episode:String(ep.ep)}); if(ep.title) params.set("title", ep.title); const r=await fetch(`/api/download?${params.toString()}`,{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`}}); const d=await r.json(); if(!r.ok||!d.url) throw new Error(d.error||"Download unavailable"); window.location.href=d.url;}catch(e){alert(e instanceof Error?e.message:"Download unavailable");}finally{setTimeout(()=>setDownloading(null),1200)}}} style={{ background:downloading===dlKey?"rgba(59,130,246,0.18)":"rgba(59,130,246,0.08)", color:BLUE, border:"1px solid rgba(59,130,246,0.28)", borderRadius:9, padding:mobile?"8px 12px":"9px 14px", fontSize:12, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}>
                    {downloading===dlKey?"Starting…":"Download"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Share / Referral hook ────────────────────────────────────────────────────
function useShareReferral() {
  const share = async (item: MediaItem) => {
    const contentId = item.sourceId || String(item.id)
    const canonicalUrl = `https://www.kilaxmovies.com/${item.type === "movie" ? "movies" : "series"}/${encodeURIComponent(contentId)}`

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        await tryShare(item.title, canonicalUrl)
        return
      }
      await fetch('/api/referral/generate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentId, contentType: item.type, contentTitle: item.title }),
      })
      await tryShare(item.title, canonicalUrl)
    } catch {
      await tryShare(item.title, canonicalUrl)
    }
  }

  return { share }
}

async function tryShare(title: string, url: string) {
  const text = `🎬 Watch "${title}" on Kilax Movies — the best Ugandan streaming platform!`
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url })
      return
    } catch {
      // user cancelled or share failed — fall through to clipboard
    }
  }
  // Fallback: copy to clipboard + show toast
  try {
    await navigator.clipboard.writeText(url)
    showShareToast()
  } catch {
    // last resort — open WhatsApp
    const wa = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`
    window.open(wa, '_blank', 'noopener,noreferrer')
  }
}

let _toastTimeout: ReturnType<typeof setTimeout> | null = null
function showShareToast() {
  const existing = document.getElementById('kilax-share-toast')
  if (existing) existing.remove()
  if (_toastTimeout) clearTimeout(_toastTimeout)
  const toast = document.createElement('div')
  toast.id = 'kilax-share-toast'
  toast.textContent = '🔗 Share link copied! Your friend gets you 50 coins when they sign up.'
  Object.assign(toast.style, {
    position: 'fixed', bottom: '88px', left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(16,185,129,0.95)', color: 'white', padding: '12px 20px',
    borderRadius: '12px', fontSize: '13px', fontWeight: '600', zIndex: '9999',
    backdropFilter: 'blur(8px)', maxWidth: '90vw', textAlign: 'center',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  })
  document.body.appendChild(toast)
  _toastTimeout = setTimeout(() => toast.remove(), 4000)
}

// ─── Media Card ───────────────────────────────────────────────────────────────
function MediaCard({ item, myList, onToggleList, onOpen, inRow=false, listAction="icon" }: { item:MediaItem; myList:Set<number>; onToggleList:(id:number)=>void; onOpen:(m:MediaItem)=>void; inRow?:boolean; listAction?:"icon"|"button" }) {
  const { mobile } = useResponsive();
  const [hov, setHov] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const [sharing, setSharing] = useState(false);
  const inList = myList.has(item.id);
  const score = Number(item.score || 0);
  const year = item.year;
  const genres = item.genres.filter((g:string)=>g.toLowerCase() !== 'musical').slice(0,3);
  const poster = !posterFailed && item.image ? item.image : (item.image || `https://via.placeholder.com/500x750/111827/94a3b8?text=${encodeURIComponent(item.title)}`);
  const vj = item.vj || "VJ";
  const { share } = useShareReferral();

  return (
    <div className="card-lift catalog-card" onClick={()=>onOpen(item)} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{ flexShrink:0, width:inRow?(mobile?118:150):"100%", minWidth:inRow?(mobile?118:150):0, cursor:"pointer", position:"relative", zIndex:hov?20:1 }}>
      <div style={{ borderRadius:12, overflow:"hidden", background:"#111827", position:"relative", border:"1px solid rgba(59,130,246,.16)", boxShadow:hov?"0 0 22px rgba(59,130,246,.18)":"none", aspectRatio:"2 / 3" }}>
        <img src={poster} alt={item.title} loading="lazy" decoding="async" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} onError={()=>setPosterFailed(true)} />
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top,rgba(13,17,23,0.98) 0%,rgba(13,17,23,0.16) 58%,transparent 100%)" }} />
        <div style={{ position:"absolute", top:10, left:10, background:item.type==="series"?"rgba(59,130,246,0.88)":"rgba(249,115,22,0.88)", backdropFilter:"blur(6px)", boxShadow:item.type==="series"?"0 0 14px rgba(59,130,246,.7)":"0 0 14px rgba(249,115,22,.7)", color:"#fff", fontSize:9, fontWeight:800, padding:"3px 9px", borderRadius:6 }}>{item.type==="series"?"SERIES":"MOVIE"}</div>
        <div style={{ position:"absolute", bottom:10, right:10, background:"rgba(59,130,246,0.84)", color:"#fff", fontSize:mobile?8:9, fontWeight:800, boxShadow:"0 0 14px rgba(59,130,246,.7)", padding:mobile?"3px 6px":"4px 9px", borderRadius:999, border:"1px solid rgba(147,197,253,.4)", maxWidth:mobile?"58%":"70%", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{vj}</div>
      </div>
      <div style={{ padding:"10px 3px 2px", display:"grid", gap:7 }}>
        <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap", minHeight:20 }}>
          <StarRating score={score}/><span style={{color:"#94a3b8",fontSize:11}}>{year || "—"}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap",minHeight:20}}>
          {listAction === "icon" && <button onClick={e=>{e.stopPropagation();onToggleList(item.id);}} aria-label={inList?"Remove from My List":"Add to My List"} title={inList?"Remove from My List":"Add to My List"} style={{marginLeft:2,width:26,height:26,minHeight:26,minWidth:26,padding:0,borderRadius:7,border:`1px solid ${inList?ORANGE:"rgba(255,255,255,.18)"}`,background:inList?"rgba(249,115,22,.14)":"rgba(255,255,255,.05)",color:inList?ORANGE:"#cbd5e1",cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center"}}><Bookmark size={14} fill={inList?"currentColor":"none"}/></button>}
          <button onClick={async e=>{e.stopPropagation();setSharing(true);await share(item);setSharing(false);}} aria-label="Share" title="Share & earn 50 coins" style={{width:26,height:26,minHeight:26,minWidth:26,padding:0,borderRadius:7,border:"1px solid rgba(16,185,129,.35)",background:"rgba(16,185,129,.08)",color:sharing?"#6ee7b7":"#10b981",cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center"}}><Share2 size={12}/></button>
          {genres.map((g:string)=><span key={g} style={{fontSize:9,color:"#93c5fd",background:"rgba(59,130,246,.1)",border:"1px solid rgba(59,130,246,.18)",padding:"2px 7px",borderRadius:10}}>{g}</span>)}
        </div>
        {listAction === "button" && <button onClick={e=>{e.stopPropagation();onToggleList(item.id);}} style={{justifySelf:"start",fontSize:10,padding:"5px 12px",borderRadius:20,border:`1px solid ${inList?ORANGE:"rgba(255,255,255,.18)"}`,background:inList?"rgba(249,115,22,.14)":"rgba(255,255,255,.05)",color:inList?ORANGE:"#cbd5e1",cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>{inList?"Listed":"+ My List"}</button>}
      </div>
    </div>
  );
}

// ─── Media Row ────────────────────────────────────────────────────────────────
function MediaRow({ label, icon: Icon, ids, myList, onToggleList, onOpen, onSeeMore }: { label:string; icon?:LucideIcon; ids:number[]; myList:Set<number>; onToggleList:(id:number)=>void; onOpen:(m:MediaItem)=>void; onSeeMore?:()=>void }) {
  const { mobile } = useResponsive();
  const items = ids.map(byId).filter(Boolean);
  const px = mobile ? 16 : 48;

  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8, paddingLeft:px, paddingRight:px }}>
        <div style={{ width:3, height:18, borderRadius:2, background:`linear-gradient(180deg,${BLUE},${ORANGE})` }} />
        {Icon && <Icon size={16} strokeWidth={2.2} color={ORANGE} aria-hidden="true" />}
        <h2 style={{ color:"white", fontSize:mobile?15:17, fontWeight:700, fontFamily:"'DM Sans',sans-serif", letterSpacing:"-0.01em", flex:1 }}>{label}</h2>
        {onSeeMore && (
          <button onClick={onSeeMore} style={{ background:"none", border:"none", color:SKYBLUE, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", whiteSpace:"nowrap" }}>See More →</button>
        )}
      </div>
      <div className="home-row-track" style={{ paddingLeft:px, paddingRight:px, paddingTop:4 }}>
        {items.map(item=><MediaCard key={item.id} item={item} myList={myList} onToggleList={onToggleList} onOpen={onOpen} inRow listAction="icon" />)}
      </div>
    </div>
  );
}

// ─── Hero Slider ──────────────────────────────────────────────────────────────
function HeroSlider({ myList, onToggleList, onInfo, onPlay }: { myList:Set<number>; onToggleList:(id:number)=>void; onInfo:(m:MediaItem)=>void; onPlay:(m:MediaItem)=>void }) {
  const { mobile } = useResponsive();
  const slides = mediaCatalog.filter(m => m.heroImage || m.image).slice(0, 5);
  const [idx,    setIdx   ] = useState(0);
  const [fading, setFading] = useState(false);
  // Per-slide enriched metadata (description + score) fetched from Reelplexi detail
  const [enriched, setEnriched] = useState<Record<string, {score:number;description:string}>>({});

  const goTo = useCallback((next:number)=>{ setFading(true); setTimeout(()=>{ setIdx(next); setFading(false); },380); },[]);
  useEffect(()=>{ const t=setInterval(()=>goTo((idx+1)%slides.length),7500); return ()=>clearInterval(t); },[idx,slides.length,goTo]);

  // Fetch detail for the current slide if description or score is missing
  useEffect(()=>{
    const slide = slides[idx];
    if (!slide?.sourceId) return;
    const key = slide.sourceId;
    // Already enriched or has data
    if (enriched[key] || (slide.description?.trim() && slide.score > 0)) return;
    let alive = true;
    (async()=>{
      try {
        const r = await fetch(`/api/reelplexi/rating?type=${slide.type}&id=${encodeURIComponent(key)}`, { cache: 'no-store' });
        if (!r.ok || !alive) return;
        const d = await r.json();
        setEnriched(prev => ({
          ...prev,
          [key]: {
            score:       Number(d.score) > 0 ? Number(d.score) : slide.score,
            description: d.overview || d.description || slide.description || '',
          },
        }));
      } catch { /* non-critical */ }
    })();
    return () => { alive = false; };
  }, [idx, slides]);

  const item = slides[idx] || mediaCatalog[0];
  if (!item) {
    return <div style={{ minHeight: mobile ? 340 : 460, display:"grid", placeItems:"center", background:BG, color:"#94a3b8" }}>Catalog temporarily unavailable.</div>;
  }
  const heroEnriched  = enriched[item.sourceId || ''];
  const heroScore     = heroEnriched?.score       > 0 ? heroEnriched.score       : Number(item.score || 0);
  const heroYear      = item.year;
  const heroStory     = (heroEnriched?.description || item.description)?.trim() || "Storyline unavailable.";
  const inList = myList.has(item.id);

  return (
    <div style={{ position:"relative", height:mobile?"52vh":"72vh", minHeight:mobile?340:460, overflow:"hidden" }}>
      <img key={item.id} src={item.heroImage||item.image} alt={item.title} className="hero-fade" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", opacity:fading?0:1, transition:"opacity 0.38s ease" }} />
      <div style={{ position:"absolute", inset:0, background:mobile?"linear-gradient(to top,rgba(13,17,23,1) 0%,rgba(13,17,23,0.6) 55%,rgba(13,17,23,0.25) 100%)":"linear-gradient(to right,rgba(13,17,23,0.97) 0%,rgba(13,17,23,0.6) 50%,rgba(13,17,23,0.08) 100%)" }} />
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top,#0d1117 0%,transparent 40%)" }} />

      {/* ── Prev / Next arrows — desktop only, hidden on mobile ── */}
        {/* ── Prev / Next arrows ── */}
        {(["l","r"] as const).map(d=>(
        <button
          key={d}
          onClick={()=>goTo(d==="l"?(idx-1+slides.length)%slides.length:(idx+1)%slides.length)}
          aria-label={d==="l"?"Previous slide":"Next slide"}
          style={{
            position:"absolute",
            [d==="l"?"left":"right"]: mobile ? 10 : 20,
            top:"50%",
            transform:"translateY(-50%)",
            zIndex:10,
            width: mobile ? 36 : 44,
            height: mobile ? 36 : 44,
            borderRadius:"50%",
            border:"1px solid rgba(255,255,255,0.18)",
            background:"rgba(13,17,23,0.55)",
            backdropFilter:"blur(14px)",
            WebkitBackdropFilter:"blur(14px)",
            color:"white",
            cursor:"pointer",
            display:"flex",
            alignItems:"center",
            justifyContent:"center",
            transition:"background .2s, border-color .2s, transform .2s",
            flexShrink:0,
          }}
          onMouseEnter={e=>{
            e.currentTarget.style.background="rgba(249,115,22,0.28)";
            e.currentTarget.style.borderColor="rgba(249,115,22,0.55)";
            e.currentTarget.style.transform="translateY(-50%) scale(1.08)";
          }}
          onMouseLeave={e=>{
            e.currentTarget.style.background="rgba(13,17,23,0.55)";
            e.currentTarget.style.borderColor="rgba(255,255,255,0.18)";
            e.currentTarget.style.transform="translateY(-50%) scale(1)";
          }}
        >
          {d==="l"
            ? <svg width={mobile?15:18} height={mobile?15:18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            : <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          }
        </button>
      ))}

      <div style={{ position:"absolute", bottom:mobile?20:48, left:mobile?16:56, right:mobile?16:56, maxWidth:mobile?"100%":560, opacity:fading?0:1, transition:"opacity 0.38s ease" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12, flexWrap:"wrap" }}>
          <div style={{ background:"white", borderRadius:5, padding:"2px 7px", display:"inline-flex", alignItems:"center" }}>
            <img src="/logo.png" alt="Kilax" style={{ height:15, objectFit:"contain" }} />
          </div>
          <span style={{ color:ORANGE, fontSize:10, fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase" }}>{item.type==="series"?"Series":"Original"}</span>
          
        </div>
        <h1 style={{ fontFamily:"'Anton',sans-serif", fontSize:mobile?38:62, color:"white", lineHeight:0.95, marginBottom:14, letterSpacing:"0.01em" }}>{item.title}</h1>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12, fontSize:12, flexWrap:"wrap" }}>
          <StarRating score={heroScore} />
          <span style={{ color:"#94a3b8" }}>{heroYear}</span>
          <span style={{color:"#93c5fd",fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:999,background:"rgba(59,130,246,.14)",border:"1px solid rgba(59,130,246,.25)"}}>{item.vj || "VJ"}</span>
        </div>
        <p style={{ color:"#cbd5e1", fontSize:mobile?12:14, lineHeight:1.6, marginBottom:mobile?16:24, maxWidth:mobile?"58%":560 }} className="clamp-2">{heroStory}</p>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <PrimaryBtn onClick={()=>onPlay(item)} style={{ fontSize:mobile?12:14, padding:mobile?"10px 18px":"12px 24px" }}>▶ Play</PrimaryBtn>
          <GlassBtn onClick={()=>onInfo(item)} style={{ fontSize:mobile?12:14, padding:mobile?"10px 14px":"12px 20px" }}>Info</GlassBtn>
          <button onClick={()=>onToggleList(item.id)} style={{ background:inList?"rgba(249,115,22,0.12)":"rgba(255,255,255,0.06)", color:inList?ORANGE:"white", border:`1px solid ${inList?ORANGE:"rgba(255,255,255,0.14)"}`, borderRadius:12, padding:mobile?"10px 14px":"12px 20px", fontSize:mobile?12:14, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>{inList?"Listed":"+ List"}</button>
        </div>
      </div>

      <nav
        aria-label="Hero slides"
        style={{
          position:"absolute",
          zIndex:11,
          ...(mobile ? { right:16, bottom:12 } : { right:72, top:"50%", transform:"translateY(-50%)" }),
          display:mobile?"none":"flex",
          flexDirection:mobile?"row":"column",
          alignItems:"center",
          gap:mobile?4:8,
          padding:mobile?"6px 8px":"10px 7px",
          borderRadius:mobile?999:18,
          background:"rgba(5,7,14,.42)",
          backdropFilter:"blur(14px)",
          WebkitBackdropFilter:"blur(14px)",
          border:"1px solid rgba(255,255,255,.12)",
        }}
      >
        {slides.map((slide, i)=>{
          const active = i===idx;
          return (
            <button
              key={slide.id}
              onClick={()=>goTo(i)}
              aria-label={`Go to slide ${i+1}: ${slide.title}`}
              aria-current={active?"true":undefined}
              style={{
                minHeight:0,
                width:mobile?30:38,
                height:mobile?30:30,
                padding:0,
                border:"none",
                borderLeft:mobile?"none":`${active?2:1}px solid ${active?ORANGE:"rgba(255,255,255,.32)"}`,
                borderTop:mobile?`${active?2:1}px solid ${active?ORANGE:"rgba(255,255,255,.32)"}`:"none",
                borderRadius:mobile?4:0,
                background:active?"rgba(249,115,22,.12)":"transparent",
                color:active?"white":"rgba(255,255,255,.52)",
                fontFamily:"'DM Sans',sans-serif",
                fontSize:11,
                fontWeight:active?800:600,
                letterSpacing:".06em",
                cursor:"pointer",
                transition:"color .2s, background .2s, border-color .2s",
              }}
            >
              {String(i+1).padStart(2,"0")}
            </button>
          );
        })}
        <span style={{ color:"rgba(255,255,255,.4)", fontSize:9, fontWeight:700, letterSpacing:".08em", writingMode:mobile?"horizontal-tb":"vertical-rl" }}>
          {String(slides.length).padStart(2,"0")}
        </span>
      </nav>
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({ item, myList, onToggleList, onClose, onPlay, onViewSeries }: { item:MediaItem; myList:Set<number>; onToggleList:(id:number)=>void; onClose:()=>void; onPlay:(m:MediaItem)=>void; onViewSeries:(m:MediaItem)=>void }) {
  const { mobile } = useResponsive();
  const vjName = item.vj || VJS[item.id % VJS.length];
  const [dl, setDl] = useState(false);
  const [sharing, setSharing] = useState(false);
  const { share } = useShareReferral();
  const [access, setAccess] = useState<{plan:string;isActive:boolean;canDownload:boolean}>({plan:"free",isActive:false,canDownload:false});
  const [reelplexiMetadata, setReelplexiMetadata] = useState({
    backdrop_url: item.heroImage,
    poster_url: item.image,
    release_date: String(item.year),
    overview: item.description,
    genres: item.genres,
    description: item.description,
    rating: item.rating,
  });
  const [score, setScore] = useState(item.score);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [downloadLocked, setDownloadLocked] = useState(false);
  const inList = myList.has(item.id);
  const storyline = reelplexiMetadata?.overview || reelplexiMetadata?.description || item.description || "Storyline unavailable.";
  const genres = (reelplexiMetadata.genres || item.genres).filter((genre: string) => genre.toLowerCase() !== 'musical');
  const hasMoreStoryline = storyline.length > 220;
  useEffect(()=>{ (async()=>{ try { const {data:{session}}=await supabase.auth.getSession(); if(session?.access_token){ const r=await fetch("/api/subscription/status",{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"}); if(r.ok){const d=await r.json();setAccess(d)} } } catch {} })() },[]);
  useEffect(()=>{
    const sourceId = item.sourceId;
    if(!sourceId) return;
    (async()=>{
      setRatingLoading(true);
      try{
        const r=await fetch(`/api/reelplexi/rating?type=${item.type}&id=${encodeURIComponent(sourceId)}`,{cache:"no-store"});
        const d=await r.json();
        if(!r.ok) return;
        if(Number(d.score)>0) setScore(Number(d.score));
        setReelplexiMetadata(current=>({
          ...current,
          overview: d.overview || d.description || current.overview,
          description: d.description || d.overview || current.description,
          release_date: d.release_date || current.release_date,
          genres: Array.isArray(d.genres) && d.genres.length ? d.genres : current.genres,
          rating: d.rating || current.rating,
        }));
      }catch{}finally{setRatingLoading(false)}
    })();
  },[item.sourceId,item.type]);
  const download = async()=>{
    if(!access.canDownload){ setDownloadLocked(true); return; }
    if(!item.sourceId){ alert("Download is not available for this title."); return; }
    setDl(true);
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token) throw new Error("Please sign in first");
      const params=new URLSearchParams({id:item.sourceId,type:item.type==="movie"?"movie":"episode"});
      if(item.type==="series"){params.set("season","1");params.set("episode","1")}
      if(item.title) params.set("title", item.title);
      const r=await fetch(`/api/download?${params.toString()}`,{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`}});
      const d=await r.json();
      if(!r.ok||!d.url) throw new Error(d.error||"Download unavailable");
      window.location.href=d.url;
    }catch(e){ alert(e instanceof Error?e.message:"Unable to start download right now."); }
    finally { setTimeout(()=>setDl(false),1800); }
  };
  return <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:65,background:"rgba(3,5,12,.88)",backdropFilter:"blur(16px)",display:"flex",alignItems:"center",justifyContent:"center",padding:mobile?8:24,boxSizing:"border-box"}}>
    <div onClick={e=>e.stopPropagation()} className="fade-up" style={{background:CARD,borderRadius:mobile?14:20,width:"100%",maxWidth:"min(740px, calc(100vw - 16px))",maxHeight:"calc(100dvh - 16px)",overflowY:"auto",border:"1px solid rgba(255,255,255,.06)",boxShadow:"0 48px 120px rgba(0,0,0,.85)",boxSizing:"border-box"}}>
      <div style={{position:"relative",height:mobile?220:360}}><img src={item.heroImage||item.image||reelplexiMetadata?.backdrop_url||reelplexiMetadata?.poster_url} alt={item.title} style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"20px 20px 0 0"}}/><div style={{position:"absolute",inset:0,background:"linear-gradient(to top,#161b2e 0%,transparent 55%)",borderRadius:"20px 20px 0 0"}}/><button onClick={onClose} style={{position:"absolute",top:12,right:12,width:36,height:36,borderRadius:"50%",background:"rgba(13,17,23,.75)",border:"1px solid rgba(255,255,255,.1)",color:"white",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={16}/></button><div style={{position:"absolute",bottom:18,left:mobile?16:28,right:mobile?16:28}}><div style={{display:"flex",gap:8,marginBottom:10}}><span style={{background:item.type==="series"?BLUE:ORANGE,color:"white",fontSize:9,fontWeight:800,padding:"4px 10px",borderRadius:6,boxShadow:`0 0 16px ${item.type==="series"?BLUE:ORANGE}`}}>{item.type==="series"?"SERIES":"MOVIE"}</span></div><h1 style={{fontFamily:"'Anton',sans-serif",fontSize:mobile?28:44,color:"white",lineHeight:.95,marginBottom:14}}>{item.title}</h1><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><PrimaryBtn onClick={()=>onPlay(item)} style={{fontSize:12,padding:"9px 18px"}}>▶ Play</PrimaryBtn><TrailerButton item={item} style={{background:"rgba(255,255,255,.08)",color:"white",border:"1px solid rgba(255,255,255,.16)",borderRadius:12,padding:"9px 14px",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:6}} />{item.type==="series"&&<GlassBtn onClick={()=>{onClose();onViewSeries(item)}} style={{fontSize:12,padding:"9px 16px"}}>All Episodes</GlassBtn>}<button onClick={()=>onToggleList(item.id)} style={{background:inList?"rgba(249,115,22,.14)":"rgba(255,255,255,.07)",color:inList?ORANGE:"white",border:`1px solid ${inList?ORANGE:"rgba(255,255,255,.13)"}`,borderRadius:12,padding:"9px 16px",fontSize:12,fontWeight:600,cursor:"pointer"}}>{inList?"Listed":"+ List"}</button></div></div></div>
      <div style={{padding:mobile?"16px 16px 24px":"20px 28px 32px"}}><div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14,fontSize:13,flexWrap:"wrap"}}><StarRating score={score}/>{ratingLoading&&<span style={{color:"#64748b",fontSize:10}}>updating rating...</span>}<span style={{color:"#94a3b8"}}>{Number(String(reelplexiMetadata?.release_date || item.year).slice(0,4)) || item.year}</span><span style={{color:ORANGE,fontWeight:600}}>VJ: {vjName}</span><RatingBadge r={reelplexiMetadata.rating || item.rating}/><span style={{color:"#94a3b8"}}>{item.type==="series"?`${item.seasons}S ${item.episodes||0}ep`:item.duration}</span></div><div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>{genres.map((genre: string)=><span key={genre} style={{color:"#bfdbfe",background:"rgba(59,130,246,.14)",border:"1px solid rgba(96,165,250,.25)",borderRadius:999,padding:"4px 9px",fontSize:11}}>{genre}</span>)}</div><ExpandableStoryline text={storyline} mobile={mobile}/><div style={{display:"flex",gap:8,flexWrap:"wrap",padding:"14px 0 0"}}><button onClick={async()=>{setSharing(true);await share(item);setSharing(false)}} disabled={sharing} style={{background:"rgba(16,185,129,.08)",color:"#10b981",border:"1px solid rgba(16,185,129,.35)",borderRadius:12,padding:"9px 14px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}><Share2 size={14}/>{sharing?"Sharing...":"Share"}</button><button onClick={download} disabled={dl} style={{background:"rgba(59,130,246,.09)",color:BLUE,border:"1px solid rgba(59,130,246,.3)",borderRadius:12,padding:"9px 14px",fontSize:12,fontWeight:700,cursor:dl?"wait":"pointer",display:"flex",alignItems:"center",gap:6}}>{dl?"Starting...":"Download"}</button></div></div>
      {downloadLocked && <PremiumPaywall item={item} action="download" onClose={()=>setDownloadLocked(false)} onUpgrade={()=>{setDownloadLocked(false); window.dispatchEvent(new Event("kilax-open-subscription"));}} />}
    </div>
  </div>;
}

// ─── Drawer ───────────────────────────────────────────────────────────────────
function Drawer({ open, onClose, page, setPage, isLoggedIn, user, onAuthOpen }: { open:boolean; onClose:()=>void; page:Page; setPage:(p:Page)=>void; isLoggedIn:boolean; user:UserProfile; onAuthOpen:(m:AuthMode)=>void }) {
  const { mobile } = useResponsive();
  const go = (p:Page) => { setPage(p); onClose(); };

  const navItems: { icon:LucideIcon; label:string; page:Page }[] = [
    { icon:Home,       label:"Home",          page:"home" },
    { icon:Film,       label:"Movies",        page:"movies" },
    { icon:Tv2,        label:"Series",        page:"series" },
    { icon:Library,    label:"Playlists",     page:"playlist" },
    { icon:Heart,      label:"My List",       page:"mylist" },
    { icon:History,    label:"Watch History", page:"history" },
    { icon:Smartphone, label:"Get App",       page:"getapp" },
  ];

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:58, background:"rgba(0,0,0,0.55)", backdropFilter:"blur(4px)", opacity:open?1:0, pointerEvents:open?"auto":"none", transition:"opacity 0.3s" }} />
      <div style={{ position:"fixed", top:0, left:0, bottom:0, zIndex:59, width:mobile?280:300, background:"#0a0e1a", borderRight:"1px solid rgba(255,255,255,0.07)", transform:open?"translateX(0)":"translateX(-100%)", transition:"transform 0.3s cubic-bezier(0.4,0,0.2,1)", display:"flex", flexDirection:"column", paddingTop:`env(safe-area-inset-top,0px)`, paddingBottom:`env(safe-area-inset-bottom,0px)`, overflowY:"auto" }}>
        <div style={{ padding:"20px 20px 16px", borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:isLoggedIn?16:0 }}>
            <KilaxLogo height={30} />
            <button onClick={onClose} style={{ background:"none", border:"none", color:"#64748b", fontSize:18, cursor:"pointer" }}>✕</button>
          </div>
        </div>

        <div style={{ padding:"12px 12px 0" }}>
          <button onClick={()=>{onClose(); window.dispatchEvent(new Event("kilax-open-search"));}} style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"12px 14px", borderRadius:12, background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.08)", color:"white", cursor:"pointer", fontWeight:700 }}><Search size={17}/> Search Kilax Movies</button>
        </div>
        <div style={{ flex:1, padding:"12px 12px" }}>
          {navItems.map(item=>(
            <button key={item.page} onClick={()=>go(item.page)} style={{ display:"flex", alignItems:"center", gap:14, width:"100%", padding:"12px 14px", borderRadius:10, background:page===item.page?"rgba(59,130,246,0.12)":"none", border:"none", cursor:"pointer", marginBottom:4, transition:"background 0.18s", color:page===item.page?"white":"#94a3b8" }}>
              <span style={{ width:24, height:24, display:"grid", placeItems:"center", borderRadius:8, background:page===item.page?"rgba(59,130,246,.18)":"rgba(255,255,255,.05)" }}><item.icon size={15} strokeWidth={2.2} /></span>
              <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:14, fontWeight:page===item.page?700:400 }}>{item.label}</span>
              {page===item.page && <div style={{ marginLeft:"auto", width:3, height:18, borderRadius:2, background:BLUE }} />}
            </button>
          ))}
        </div>

        <div style={{ padding:"12px 12px 16px", borderTop:"1px solid rgba(255,255,255,0.05)" }}>
          {isLoggedIn ? (
            <>
              <button onClick={()=>go("profile")} style={{ display:"flex", alignItems:"center", gap:12, width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"12px 14px", cursor:"pointer", marginBottom:8 }}>
                <Avatar emoji={user.avatar} bg={user.avatarBg} size={38} />
                <div style={{ textAlign:"left", minWidth:0 }}><p style={{ color:"white", fontWeight:700, fontSize:14, margin:0 }} className="clamp-1">{user.name}</p><p style={{ color:"#64748b", fontSize:11, margin:0 }}>View Profile</p></div>
                <UserRound size={15} color="#64748b" style={{ marginLeft:"auto" }} />
              </button>
              <button onClick={()=>go("subscription")} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"12px 14px", borderRadius:10, background:`linear-gradient(135deg,rgba(14,165,233,0.15),rgba(59,130,246,0.1))`, border:`1px solid ${SKYBLUE}44`, cursor:"pointer" }}>
                <Crown size={16} color={SKYBLUE} />
                <span style={{ color:SKYBLUE, fontFamily:"'DM Sans',sans-serif", fontSize:14, fontWeight:700 }}>Upgrade to Standard</span>
              </button>
            </>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <BlueBtn onClick={()=>{ onAuthOpen("login"); onClose(); }} style={{ width:"100%", justifyContent:"center", fontSize:13 }}>Log In</BlueBtn>
              <GlassBtn onClick={()=>{ onAuthOpen("signup"); onClose(); }} style={{ width:"100%", justifyContent:"center", fontSize:13 }}>Create Account</GlassBtn>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar({ page, setPage, scrolled, myListCount, onSearch, onNotif, unreadCount, user, isLoggedIn, onAuthOpen, onDrawer }: { page:Page; setPage:(p:Page)=>void; scrolled:boolean; myListCount:number; onSearch:()=>void; onNotif:()=>void; unreadCount:number; user:UserProfile; isLoggedIn:boolean; onAuthOpen:(m:AuthMode)=>void; onDrawer:()=>void }) {
  const { mobile } = useResponsive();

  const links: { label:string; page:Page }[] = [
    { label:"Home",    page:"home" },
    { label:"Movies",  page:"movies" },
    { label:"Series",  page:"series" },
    { label:"My List", page:"mylist" },
  ];

  return (
    <nav className="glass navbar-safe" style={{ position:"fixed", top:0, left:0, right:0, zIndex:50, display:"flex", alignItems:"center", justifyContent:"space-between", paddingTop:`env(safe-area-inset-top,0px)`, paddingBottom:0, paddingLeft:mobile?"16px":"24px", paddingRight:mobile?"16px":"48px", minHeight:mobile?"calc(54px + env(safe-area-inset-top,0px))":"calc(66px + env(safe-area-inset-top,0px))", borderBottom:scrolled?"1px solid rgba(255,255,255,0.06)":"1px solid transparent", transition:"all 0.3s", boxSizing:"border-box" }}>
      <div style={{ display:"flex", alignItems:"center", gap:mobile?10:16 }}>
        <button onClick={onDrawer} style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8", padding:"6px", display:"flex", flexDirection:"column", gap:4, alignItems:"center" }}>
          <div style={{ width:20, height:2, background:"#94a3b8", borderRadius:1 }} />
          <div style={{ width:20, height:2, background:"#94a3b8", borderRadius:1 }} />
          <div style={{ width:20, height:2, background:"#94a3b8", borderRadius:1 }} />
        </button>
        <button className="navbar-brand hide-mobile" onClick={()=>setPage("home")} style={{ background:"none", border:"none", cursor:"pointer", padding:0, display:"flex", alignItems:"center" }}>
          <div style={{ background:"white", borderRadius:7, padding:mobile?"3px 8px":"4px 10px", display:"flex", alignItems:"center", boxShadow:"0 2px 10px rgba(0,0,0,0.3)" }}>
            <img src="/logo.png" alt="Kilax Movies" style={{ height:mobile?28:36, objectFit:"contain", display:"block" }} />
          </div><span style={{color:"white",fontWeight:800,fontSize:mobile?14:17,whiteSpace:"nowrap",marginLeft:mobile?4:8}}>Kilax Movies</span>
        </button>
      </div>

      {!mobile && (
        <div style={{ display:"flex", gap:24 }}>
          {links.map(l=>(
            <button key={l.page} onClick={()=>setPage(l.page)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:14, color:page===l.page?"white":"#64748b", fontWeight:page===l.page?600:400, position:"relative", fontFamily:"'DM Sans',sans-serif", transition:"color 0.18s", padding:"4px 0" }}>
              {l.label}
              {l.page==="mylist"&&myListCount>0&&<span style={{ position:"absolute", top:-6, right:-10, background:ORANGE, color:"white", fontSize:9, fontWeight:700, borderRadius:"50%", width:16, height:16, display:"flex", alignItems:"center", justifyContent:"center" }}>{myListCount}</span>}
              {page===l.page&&<div style={{ position:"absolute", bottom:-4, left:"50%", transform:"translateX(-50%)", width:16, height:2, borderRadius:1, background:`linear-gradient(90deg,${BLUE},${ORANGE})` }} />}
            </button>
          ))}
        </div>
      )}

      <div style={{ display:"flex", alignItems:"center", gap:mobile?10:12 }}>
        <button onClick={onSearch} style={{ background:"none", border:"none", cursor:"pointer", color:"#64748b", fontSize:mobile?18:14, padding:"6px", fontFamily:"'DM Sans',sans-serif" }} onMouseEnter={e=>(e.currentTarget.style.color="white")} onMouseLeave={e=>(e.currentTarget.style.color="#64748b")}><Search size={mobile?19:17}/></button>
        {isLoggedIn && (
          <button onClick={onNotif} aria-label={unreadCount>0 ? `${unreadCount} unread notifications` : "Notifications"} className={unreadCount>0?"notification-bell-active":""} style={{ background:"none", border:"none", cursor:"pointer", color:"#64748b", fontSize:mobile?18:16, padding:"6px", position:"relative", display:"flex", alignItems:"center", justifyContent:"center" }} onMouseEnter={e=>(e.currentTarget.style.color="white")} onMouseLeave={e=>(e.currentTarget.style.color="#64748b")}>
            <Bell size={mobile?20:18} strokeWidth={2.2}/>
            {unreadCount>0&&<span style={{ position:"absolute", top:2, right:2, background:ORANGE, color:"white", fontSize:8, fontWeight:700, borderRadius:"50%", width:14, height:14, display:"flex", alignItems:"center", justifyContent:"center" }}>{unreadCount}</span>}
          </button>
        )}
        {isLoggedIn ? (
          <>
            <button onClick={()=>setPage("subscription")} style={{ background:SKYBLUE, color:"white", border:"none", borderRadius:8, padding:mobile?"6px 12px":"7px 14px", fontSize:mobile?11:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>UPGRADE</button>
            {!mobile && (
              <button onClick={()=>setPage("profile")} style={{ background:"none", border:"none", cursor:"pointer", borderRadius:"50%", outline:page==="profile"?`2px solid ${BLUE}`:"2px solid transparent", outlineOffset:3, padding:0 }}>
                <Avatar emoji={user.avatar} bg={user.avatarBg} size={36} />
              </button>
            )}
          </>
        ) : (
          <div style={{ display:"flex", gap:8 }}>
            <GlassBtn onClick={()=>onAuthOpen("login")} style={{ padding:"7px 14px", fontSize:12 }}>Log In</GlassBtn>
            {!mobile && <BlueBtn onClick={()=>onAuthOpen("signup")} style={{ padding:"7px 14px", fontSize:12 }}>Get Started</BlueBtn>}
          </div>
        )}
      </div>
    </nav>
  );
}

// ─── Search Overlay ───────────────────────────────────────────────────────────
function SearchOverlay({ onClose, onOpen }: { onClose:()=>void; onOpen:(m:MediaItem)=>void }) {
  const { mobile } = useResponsive();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(()=>{ ref.current?.focus(); },[]);
  useEffect(()=>{ if(!q.trim()){setResults([]);return;} const t=setTimeout(async()=>{setLoading(true); try{const [searchResponse, genreResponse]=await Promise.all([fetch(`/api/reelplexi/search?q=${encodeURIComponent(q)}&type=all`,{cache:"no-store"}), fetch(`/api/reelplexi/genre?genre=${encodeURIComponent(q)}&type=all&limit=50`,{cache:"no-store"})]); const [searchData, genreData]=await Promise.all([searchResponse.json(), genreResponse.json()]); const rows=[...(Array.isArray(searchData.data)?searchData.data:[]), ...(Array.isArray(genreData.data)?genreData.data:[])]; const seen=new Set<string>(); setResults(rows.filter((x:any)=>{const key=`${x.type||"movie"}-${x.id}`; if(seen.has(key)) return false; seen.add(key); return true;}).map((x:any,i:number)=>mapReelplexiItem(x,x.type==="series"?"series":"movie",i)));}catch{setResults([])}finally{setLoading(false)}},260); return()=>clearTimeout(t); },[q]);
  const categories = ["Action","Adventure","Comedy","Crime","Drama","Fantasy","Horror","Romance","Sci-Fi","Thriller"];
  return <div style={{ position:"fixed", inset:0, zIndex:60, background:"rgba(5,7,14,.98)", backdropFilter:"blur(24px)", display:"flex", flexDirection:"column", paddingTop:`env(safe-area-inset-top,0px)` }}>
    <div style={{ padding:mobile?"14px 16px":"20px 48px", borderBottom:"1px solid rgba(255,255,255,.07)" }}>
      <div style={{ maxWidth:900, margin:"0 auto", display:"flex", alignItems:"center", gap:12, background:"rgba(255,255,255,.055)", border:"1px solid rgba(96,165,250,.22)", borderRadius:18, padding:"4px 8px 4px 16px", boxShadow:"0 0 28px rgba(59,130,246,.08)" }}>
        <Search size={20} color="#60a5fa"/><input ref={ref} value={q} onChange={e=>setQ(e.target.value)} placeholder="Search movies, series and genres in Kilax…" style={{ flex:1, background:"transparent", border:"none", color:"white", fontSize:mobile?15:18, fontFamily:"'DM Sans',sans-serif", outline:"none", padding:"12px 0" }}/>{q&&<button onClick={()=>setQ("")} style={{background:"none",border:0,color:"#64748b",cursor:"pointer"}}><X size={18}/></button>}<button onClick={onClose} style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.08)",color:"#cbd5e1",borderRadius:10,padding:"8px 12px",cursor:"pointer"}}>Close</button>
      </div>
    </div>
    <div style={{ flex:1, overflowY:"auto", padding:mobile?"16px":"28px 48px" }}>
      {q.trim().length<=1 ? <div style={{maxWidth:1100,margin:"0 auto"}}><p style={{color:"#475569",fontSize:11,fontWeight:800,letterSpacing:".12em",textTransform:"uppercase",marginBottom:14}}>Browse genres</p><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{categories.map(t=><button key={t} onClick={()=>setQ(t)} style={{padding:"9px 16px",borderRadius:20,background:"rgba(59,130,246,.07)",border:"1px solid rgba(59,130,246,.18)",color:"#93c5fd",cursor:"pointer"}}>{t}</button>)}</div></div> : loading ? <div style={{display:"grid",placeItems:"center",height:220,color:"#64748b"}}>Searching Kilax Movies database…</div> : results.length===0 ? <p style={{color:"#64748b",fontSize:15}}>No results for <span style={{color:"white"}}>{q}</span></p> : <div style={{maxWidth:1100,margin:"0 auto"}}><p style={{color:"#64748b",fontSize:13,marginBottom:16}}>{results.length} result{results.length!==1?"s":""}</p><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12}}>{results.map(m=><div key={`${m.type}-${m.id}`} onClick={()=>{window.dispatchEvent(new Event("kilax-content-interacted"));onOpen(m);onClose()}} style={{cursor:"pointer"}}><MediaCard item={m} myList={new Set()} onToggleList={()=>{}} onOpen={onOpen} listAction="button"/></div>)}</div></div>}
    </div>
  </div>;
}

// ─── Notifications Panel ──────────────────────────────────────────────────────
function NotificationsPanel({ onClose, notifs, onRead }: { onClose:()=>void; notifs:AppNotification[]; onRead:(id:string)=>void }) {
  const { mobile } = useResponsive();
  const unread = notifs.filter(n=>!n.read_at).length;
  const markAllRead = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) await fetch("/api/notifications", { method:"PATCH", headers:{ Authorization:`Bearer ${session.access_token}`, "Content-Type":"application/json" }, body:JSON.stringify({notificationId:"all"}) });
    notifs.forEach(n=>onRead(n.id));
  };

  return (
    <div className="fade-up" style={{ position:"fixed", top:mobile?0:`calc(72px + env(safe-area-inset-top,0px))`, right:mobile?0:48, left:mobile?0:undefined, zIndex:55, width:mobile?"100%":360, background:CARD, border:"1px solid rgba(255,255,255,0.08)", borderRadius:mobile?0:18, boxShadow:"0 32px 80px rgba(0,0,0,0.85)", maxHeight:mobile?"100vh":"460px", display:"flex", flexDirection:"column", paddingTop:mobile?`env(safe-area-inset-top,0px)`:undefined }}>
      <div style={{ padding:"16px 20px", borderBottom:"1px solid rgba(255,255,255,0.05)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <Bell className={unread>0?"notification-bell-active":""} size={19} />
          {unread>0&&<span style={{ background:ORANGE, color:"white", fontSize:10, fontWeight:700, borderRadius:20, padding:"2px 8px" }}>{unread} new</span>}
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={markAllRead} style={{ background:"none", border:"none", color:BLUE, fontSize:12, cursor:"pointer" }}>Mark all read</button>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#64748b", fontSize:15, cursor:"pointer" }}>✕</button>
        </div>
      </div>
      <div style={{ flex:1, overflowY:"auto" }}>
        {notifs.map(n=>(
          <div key={n.id} onClick={()=>{onRead(n.id); if (n.url) window.location.href=n.url}} style={{ padding:"14px 20px", borderBottom:"1px solid rgba(255,255,255,0.04)", background:!n.read_at?"rgba(59,130,246,0.04)":"transparent", cursor:n.url?"pointer":"default", display:"flex", gap:14, alignItems:"flex-start" }} onMouseEnter={e=>(e.currentTarget.style.background="rgba(255,255,255,0.03)")} onMouseLeave={e=>(e.currentTarget.style.background=!n.read_at?"rgba(59,130,246,0.04)":"transparent")}>
            <span style={{ fontSize:20 }}>{n.icon}</span>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                <p style={{ color:"white", fontSize:13, fontWeight:!n.read_at?700:500, margin:0 }}>{n.title}</p>
                {!n.read_at&&<span style={{ width:7, height:7, borderRadius:"50%", background:BLUE, flexShrink:0, marginTop:4 }} />}
              </div>
              <p style={{ color:"#64748b", fontSize:12, margin:0, lineHeight:1.5 }}>{n.body}</p>
              <p style={{ color:"#334155", fontSize:11, margin:"4px 0 0" }}>{new Date(n.created_at).toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>
      <button onClick={()=>{ onClose(); window.location.href="/notifications" }} style={{ margin:12, padding:"10px 12px", borderRadius:10, border:"1px solid rgba(96,165,250,.25)", background:"rgba(59,130,246,.1)", color:"#93c5fd", cursor:"pointer", fontWeight:700 }}>View more notifications</button>
    </div>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────
function FilterBar({ search, onSearch, genre, onGenre, genres, accentColor, vj, onVj, vjOptions=VJS, hasFilters, onClear }: { search:string; onSearch:(v:string)=>void; genre:string; onGenre:(g:string)=>void; genres:string[]; accentColor:string; vj:string; onVj:(v:string)=>void; vjOptions?:string[]; hasFilters:boolean; onClear:()=>void }) {
  const { mobile } = useResponsive();
  const px = mobile ? 16 : 48;
  return (
    <div style={{ paddingLeft:px, paddingRight:px, marginBottom:24, display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ position:"relative", flex:1, maxWidth:280 }}>
          <input value={search} onChange={e=>onSearch(e.target.value)} placeholder="Search titles..." style={{ ...inputSt, paddingLeft:16 }} />
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ color:"#475569", fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", whiteSpace:"nowrap" }}>VJ</span>
          <select value={vj} onChange={e=>onVj(e.target.value)} style={{ background:CARD, border:"1px solid rgba(255,255,255,0.1)", color:"#94a3b8", padding:"8px 12px", borderRadius:10, fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", outline:"none" }}>
            <option value="All VJs">All VJs</option>
            {vjOptions.map(v=><option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
        <span style={{ color:"#475569", fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase" }}>Genre</span>
        {genres.map(g=><Pill key={g} active={genre===g} color={accentColor} onClick={()=>onGenre(g)}>{g}</Pill>)}
        {hasFilters && <button onClick={onClear} style={{ marginLeft:"auto", background:"rgba(239,68,68,.08)", border:"1px solid rgba(239,68,68,.25)", color:"#fca5a5", borderRadius:10, padding:"7px 12px", fontSize:11, cursor:"pointer" }}>Clear filters</button>}
      </div>
    </div>
  );
}

function CatalogPage({ type, title, accentColor, myList, onToggleList, onOpen, initialGenre="All", initialFilter="all" }: { type:'movie'|'series'; title:string; accentColor:string; myList:Set<number>; onToggleList:(id:number)=>void; onOpen:(item:MediaItem)=>void; initialGenre?:string; initialFilter?:'all'|'latest' }) {
  const { mobile } = useResponsive()
  const collection = useCatalogCollection({
    type,
    endpoint: `/api/reelplexi/${type === 'movie' ? 'movies' : 'series'}`,
    initialVjs: type === 'movie' ? VJS : [],
    getCatalog: getMediaCatalog,
    initialGenre,
    initialFilter,
  })
  const px = mobile ? 16 : 48

  return <div style={{ paddingTop:`calc(${mobile?54:66}px + env(safe-area-inset-top,0px))`, paddingBottom:60, minHeight:'100%', background:BG }}>
    <div style={{ padding:`28px ${px}px 20px` }}><h1 style={{ fontFamily:"'Anton',sans-serif", fontSize:mobile?34:44, color:'white', marginBottom:4 }}>{title}</h1><p style={{ color:'#64748b', fontSize:13 }}>More titles are loaded as you scroll</p></div>
    <FilterBar search={collection.search} onSearch={collection.setSearch} genre={collection.genre} onGenre={collection.setGenre} genres={collection.genres} accentColor={accentColor} vj={collection.vj} onVj={collection.setVj} vjOptions={collection.vjOptions} hasFilters={collection.filter!=="all"||collection.genre!=="All"||collection.vj!=="All VJs"||Boolean(collection.search.trim())} onClear={collection.clearFilters} />
    <div className="responsive-card-grid" style={{ paddingLeft:px, paddingRight:px }}>
      {collection.filtered.map(item => <MediaCard key={item.id} item={item} myList={myList} onToggleList={onToggleList} onOpen={onOpen} />)}
    </div>
    <div ref={collection.sentinel} style={{ height:80, display:'grid', placeItems:'center', color:'#64748b', fontSize:12 }}>{collection.loading ? `Loading more ${type === 'movie' ? 'movies' : 'series'}...` : collection.hasMore ? 'Scroll for more' : "You've reached the end"}</div>
  </div>
}

// ─── My List Page ─────────────────────────────────────────────────────────────
function MyListPage({ myList, onToggleList, onOpen }: { myList:Set<number>; onToggleList:(id:number)=>void; onOpen:(m:MediaItem)=>void }) {
  const { mobile } = useResponsive();
  const items = mediaCatalog.filter(m=>myList.has(m.id));
  const px = mobile?16:48;
  return (
    <div style={{ paddingTop:`calc(${mobile?54:66}px + env(safe-area-inset-top,0px))`, paddingBottom:60, minHeight:"100%", background:BG }}>
      <div style={{ padding:`28px ${px}px 24px` }}>
        <h1 style={{ fontFamily:"'Anton',sans-serif", fontSize:mobile?34:44, color:"white", marginBottom:4 }}>My List</h1>
        <p style={{ color:"#64748b", fontSize:13 }}>{items.length} saved</p>
      </div>
      {items.length===0 ? (
        <div style={{ textAlign:"center", paddingTop:60 }}>
          <p style={{ color:"#475569", fontSize:16, marginBottom:8 }}>Your list is empty</p>
          <p style={{ color:"#334155", fontSize:13 }}>Tap My List on any title</p>
        </div>
      ) : (
        <div className="responsive-card-grid" style={{ paddingLeft:px, paddingRight:px }}>
          {items.map(m=><MediaCard key={m.id} item={m} myList={myList} onToggleList={onToggleList} onOpen={onOpen} listAction="button" />)}
        </div>
      )}
    </div>
  );
}

// ─── Watch History Page ───────────────────────────────────────────────────────
function HistoryPage({ history, onOpen, onClear }: { history:number[]; onOpen:(m:MediaItem)=>void; onClear:()=>void }) {
  const { mobile } = useResponsive();
  const px = mobile?16:48;
  const items = history.map(id=>mediaCatalog.find(m=>m.id===id)).filter(Boolean) as MediaItem[];

  return (
    <div style={{ paddingTop:`calc(${mobile?54:66}px + env(safe-area-inset-top,0px))`, paddingBottom:60, minHeight:"100%", background:BG }}>
      <div style={{ padding:`28px ${px}px 24px`, display:"flex", alignItems:"flex-end", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <div>
          <h1 style={{ fontFamily:"'Anton',sans-serif", fontSize:mobile?34:44, color:"white", marginBottom:4 }}>Watch History</h1>
          <p style={{ color:"#64748b", fontSize:13 }}>{items.length} items</p>
        </div>
        {items.length>0 && (
          <button onClick={onClear} style={{ background:"rgba(239,68,68,0.08)", color:"#ef4444", border:"1px solid rgba(239,68,68,0.2)", borderRadius:10, padding:"9px 18px", fontSize:13, fontWeight:600, cursor:"pointer" }}>Clear History</button>
        )}
      </div>
      {items.length===0 ? (
        <div style={{ textAlign:"center", paddingTop:80 }}>
          <p style={{ fontSize:48, marginBottom:12 }}>⏱</p>
          <p style={{ color:"#475569", fontSize:16, marginBottom:8 }}>No watch history yet</p>
          <p style={{ color:"#334155", fontSize:13 }}>Start watching to build your history</p>
        </div>
      ) : (
        <div className="responsive-card-grid history-card-grid" style={{ paddingLeft:px, paddingRight:px }}>
          {items.map(m=><MediaCard key={m.id} item={m} myList={new Set()} onToggleList={()=>{}} onOpen={onOpen} listAction="button" />)}
        </div>
      )}
    </div>
  );
}

// ─── Get App Page ─────────────────────────────────────────────────────────────
function GetAppPage() {
  const { mobile } = useResponsive();
  const px = mobile?16:48;
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  useEffect(() => {
    const capturePrompt = (event: Event) => { event.preventDefault(); setInstallPrompt(event); };
    window.addEventListener("beforeinstallprompt", capturePrompt);
    return () => window.removeEventListener("beforeinstallprompt", capturePrompt);
  }, []);
  const installPwa = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  };
  return (
    <div style={{ paddingTop:`calc(${mobile?54:66}px + env(safe-area-inset-top,0px))`, paddingBottom:80, minHeight:"100%", background:BG }}>
      <div style={{ maxWidth:600, margin:"0 auto", padding:`0 ${px}px`, textAlign:"center" }}>
        <div style={{ margin:"60px 0 36px" }}>
          <div style={{ fontSize:80, marginBottom:24 }}>📱</div>
          <h1 style={{ fontFamily:"'Anton',sans-serif", fontSize:mobile?36:52, color:"white", marginBottom:14, lineHeight:1 }}>Kilax Movies App</h1>
          <p style={{ color:"#64748b", fontSize:15, lineHeight:1.75, marginBottom:32 }}>Watch your favourite movies and series with VJ audio on the go. Download the Kilax Movies app and enjoy unlimited streaming anytime, anywhere.</p>
          <a href="https://play.google.com/store/apps/details?id=com.app.kilax" target="_blank" rel="noopener noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:14, background:"#1a1a2e", border:"1px solid rgba(255,255,255,0.14)", borderRadius:16, padding:"16px 28px", textDecoration:"none", transition:"all 0.2s", boxShadow:"0 8px 32px rgba(0,0,0,0.4)" }}
            onMouseEnter={e=>((e.currentTarget as HTMLAnchorElement).style.transform="scale(1.04)")}
            onMouseLeave={e=>((e.currentTarget as HTMLAnchorElement).style.transform="scale(1)")}
          >
            <span style={{ fontSize:36 }}>▶</span>
            <div style={{ textAlign:"left" }}>
              <p style={{ color:"#94a3b8", fontSize:11, margin:0, letterSpacing:"0.05em" }}>GET IT ON</p>
              <p style={{ color:"white", fontSize:22, fontWeight:700, margin:0, fontFamily:"'DM Sans',sans-serif" }}>Google Play</p>
            </div>
          </a>
          <div style={{ display:"grid", gridTemplateColumns:mobile?"1fr":"repeat(3,1fr)", gap:10, marginTop:16, textAlign:"left" }}>
            <button onClick={()=>void installPwa()} disabled={!installPrompt} style={{ background:installPrompt?"rgba(59,130,246,.14)":"rgba(255,255,255,.04)", border:"1px solid rgba(96,165,250,.25)", borderRadius:12, padding:14, color:installPrompt?"#bfdbfe":"#64748b", cursor:installPrompt?"pointer":"default" }}>
              <strong style={{ display:"block", color:installPrompt?"white":"#94a3b8", marginBottom:4 }}>Install PWA</strong>
              <span style={{ fontSize:11 }}>Windows, Android and supported browsers</span>
            </button>
            <div style={{ background:CARD, border:"1px solid rgba(255,255,255,.06)", borderRadius:12, padding:14 }}><strong style={{ display:"block", color:"white", marginBottom:4 }}>iPhone / iPad</strong><span style={{ color:"#64748b", fontSize:11 }}>Open Kilax in Safari, tap Share, then Add to Home Screen.</span></div>
            <div style={{ background:CARD, border:"1px solid rgba(255,255,255,.06)", borderRadius:12, padding:14 }}><strong style={{ display:"block", color:"white", marginBottom:4 }}>Smart TV</strong><span style={{ color:"#64748b", fontSize:11 }}>Open Kilax in the TV browser and choose Add to Home Screen or bookmark it.</span></div>
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:14, marginTop:32 }}>
          {[
            { icon:"🎬", title:"All VJ Audio", desc:"Watch dubbed in your preferred VJ voice" },
            { icon:"📥", title:"Offline Downloads", desc:"Download and watch without internet" },
            { icon:"📺", title:"HD Streaming", desc:"Enjoy crisp 1080p and 4K quality" },
            { icon:"🔔", title:"New Release Alerts", desc:"Never miss a new episode or movie" },
          ].map(f=>(
            <div key={f.title} style={{ background:CARD, border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:"20px 16px", textAlign:"left" }}>
              <p style={{ fontSize:28, marginBottom:8 }}>{f.icon}</p>
              <p style={{ color:"white", fontWeight:700, fontSize:14, marginBottom:4 }}>{f.title}</p>
              <p style={{ color:"#64748b", fontSize:12, lineHeight:1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ReelPlexi Playlists Page ────────────────────────────────────────────────
function PlaylistsPage({ onOpen }: { onOpen:(m:MediaItem)=>void }) {
  const { mobile } = useResponsive();
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const px = mobile ? 16 : 48;

  useEffect(() => {
    fetch('/api/reelplexi/playlists', { cache: 'no-store' })
      .then(response => response.json())
      .then(payload => setPlaylists(Array.isArray(payload.playlists) ? payload.playlists : []))
      .catch(() => setPlaylists([]))
      .finally(() => setLoading(false));
  }, []);

  const openPlaylist = async (playlist: any) => {
    setSelected(playlist);
    if (!playlist?.id) return;
    try {
      const response = await fetch(`/api/reelplexi/playlists?id=${encodeURIComponent(String(playlist.id))}`, { cache: 'no-store' });
      const payload = await response.json();
      if (payload.playlist) setSelected(payload.playlist);
    } catch { /* Keep the list response as a usable fallback. */ }
  };

  const rawItems = selected?.items || selected?.content || selected?.movies || selected?.series || [];
  const items = Array.isArray(rawItems) ? rawItems.map((raw:any, index:number) => {
    const type = raw.content_type === 'series' || raw.type === 'series' || raw.series_id ? 'series' : 'movie';
    return mapReelplexiItem(raw.movie || raw.series || raw, type, index);
  }) : [];

  return (
    <div style={{ paddingTop:`calc(${mobile?54:66}px + env(safe-area-inset-top,0px))`, paddingBottom:80, minHeight:'100%', background:BG }}>
      <div style={{ padding:`28px ${px}px 22px`, borderBottom:'1px solid rgba(255,255,255,.06)' }}>
        <p style={{ color:ORANGE, fontSize:11, fontWeight:800, letterSpacing:'.16em', textTransform:'uppercase', marginBottom:8 }}>Kilax Collections</p>
        <h1 style={{ color:'white', fontFamily:"'Anton',sans-serif", fontSize:mobile?36:52, lineHeight:1, marginBottom:10 }}>Playlists</h1>
        <p style={{ color:'#64748b', fontSize:14, maxWidth:600, lineHeight:1.7 }}>Browse hand-picked collections of movies and series from Kilax.</p>
      </div>
      {loading ? <LoadingBars label="Loading playlists" /> : playlists.length === 0 ? (
        <div style={{ padding:`70px ${px}px`, textAlign:'center', color:'#64748b' }}><Library size={34} style={{ margin:'0 auto 14px', color:ORANGE }} /><p>No playlists are available yet.</p></div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:mobile?'1fr':'repeat(auto-fit,minmax(240px,1fr))', gap:14, padding:`24px ${px}px` }}>
          {playlists.map((playlist:any) => (
            <button key={playlist.id} onClick={() => openPlaylist(playlist)} style={{ textAlign:'left', padding:20, minHeight:150, borderRadius:16, border:selected?.id===playlist.id?`1px solid ${ORANGE}`:'1px solid rgba(255,255,255,.08)', background:selected?.id===playlist.id?'rgba(249,115,22,.12)':CARD, color:'white', cursor:'pointer' }}>
              <Library size={20} color={ORANGE} style={{ marginBottom:26 }} />
              <h2 style={{ fontSize:18, marginBottom:6 }}>{playlist.name || playlist.title || 'Untitled playlist'}</h2>
              <p style={{ color:'#64748b', fontSize:12, lineHeight:1.5 }}>{playlist.description || 'A ReelPlexi collection curated for Kilax viewers.'}</p>
            </button>
          ))}
        </div>
      )}
      {selected && <div style={{ padding:`8px ${px}px 0` }}>
        <h2 style={{ color:'white', fontSize:22, marginBottom:14 }}>{selected.name || selected.title || 'Playlist titles'}</h2>
        {items.length === 0 ? <p style={{ color:'#64748b', fontSize:13 }}>This playlist has no published titles.</p> : <div className="responsive-card-grid">{items.map(item => <MediaCard key={`${item.type}-${item.id}`} item={item} myList={new Set()} onToggleList={()=>{}} onOpen={onOpen} listAction="button" />)}</div>}
      </div>}
    </div>
  );
}

// ─── Subscription Page ────────────────────────────────────────────────────────
function SubscriptionPage({ onSuccess }: { onSuccess?:()=>void }) {
  const { mobile } = useResponsive();
  const [plans, setPlans] = useState<any[]>([]);
  const [chosen, setChosen] = useState<any|null>(null);
  const [method, setMethod] = useState<"mobile_money"|"card"|null>(null);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string|null>(null);
  const [paymentError, setPaymentError] = useState<string|null>(null);
  // 'idle' | 'polling' | 'success' | 'timeout'
  const [paymentState, setPaymentState] = useState<"idle"|"polling"|"success"|"timeout">("idle");
  const [activePlan, setActivePlan] = useState<{name:string;expiry:string}|null>(null);
  const [friendLink, setFriendLink] = useState<string|null>(null);
  const [giftToken, setGiftToken] = useState<string|null>(null);
  const [friendLinkBusy, setFriendLinkBusy] = useState(false);
  const [friendLinkCopied, setFriendLinkCopied] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    supabase.from("plans").select("*").order("amount", { ascending:true }).then(({data,error}) => {
      if (error) setMessage(error.message);
      else setPlans((data || []).filter((p:any) => p.name && p.amount));
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedPlan = params.get("plan");
    const sharedGift = params.get("gift");
    if (sharedGift) setGiftToken(sharedGift);
    if (sharedPlan && plans.length) {
      setChosen(plans.find((plan:any) => String(plan.id) === sharedPlan || String(plan.name) === sharedPlan) || null);
    }
  }, [plans]);

  // Cancel any in-flight poll when the component unmounts
  useEffect(() => {
    cancelledRef.current = false;
    return () => { cancelledRef.current = true; };
  }, []);

  const pay = async () => {
    if (!chosen || !method) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data: { session } } = await supabase.auth.getSession();
    if ((!user || !session?.access_token) && !giftToken) { setPaymentError("Please sign in before purchasing a subscription."); return; }
    if (method === "mobile_money" && !phone) { setPaymentError("Enter your MTN or Airtel number."); return; }
    setBusy(true); setPaymentError(null); setMessage(null);
    cancelledRef.current = false;

    try {
      const response = await fetch("/api/payment/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ userId:user?.id, amount:chosen.amount, description:`Subscription: ${chosen.name}`, paymentMethod:method, phoneNumber:phone, planId:chosen.id, giftToken }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Payment failed to start");

      // Card payments redirect out — nothing more to do here
      if (method === "card" && result.redirectUrl) { window.location.href = result.redirectUrl; return; }

      setPaymentState("polling");
      setMessage("Check your phone and confirm the Mobile Money prompt.");

      const started = Date.now();
      const POLL_TIMEOUT = 150_000; // 2.5 min

      const poll = async (): Promise<void> => {
        if (cancelledRef.current) return;
        try {
          const statusRes = await fetch(
            `/api/payment/status?transactionId=${encodeURIComponent(result.uuid)}${giftToken ? `&gift=${encodeURIComponent(giftToken)}` : ""}`,
            { headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}, cache: "no-store" }
          );
          const statusData = await statusRes.json();
          if (cancelledRef.current) return;

          // 404 means the transaction isn't in our DB yet (insert may have been slow)
          // — keep polling silently rather than showing an error
          if (statusRes.status === 404) {
            if (Date.now() - started < POLL_TIMEOUT) {
              setMessage("Waiting for payment confirmation…");
              setTimeout(poll, 5_000);
            } else {
              setPaymentState("timeout");
              setMessage("Payment is still being confirmed. Your subscription will activate automatically once confirmed.");
              setBusy(false);
            }
            return;
          }

          // Any other non-2xx is a real server error
          if (!statusRes.ok) {
            throw new Error(statusData?.error || `Status check failed (${statusRes.status})`);
          }

          const state = String(statusData.status || "").toLowerCase();

          if (["completed", "successful", "success", "sandbox", "paid"].includes(state)) {
            // Activate subscription server-side
            const completeRes = await fetch("/api/payment/complete", {
              method: "POST",
              headers: { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
              body: JSON.stringify({
                transactionId: result.uuid,
                subscriptionPlan: statusData.plan || chosen.name,
                subscriptionDuration: statusData.duration ?? (chosen.duration_in_hours ? chosen.duration_in_hours / 24 : (chosen.duration_in_days || 30)),
                giftToken,
              }),
            });
            if (!completeRes.ok) {
              const body = await completeRes.json().catch(() => ({}));
              throw new Error(body.error || "Subscription activation failed");
            }
            const completeData = await completeRes.json().catch(() => ({}));
            if (cancelledRef.current) return;
            setActivePlan({ name: statusData.plan || chosen.name, expiry: completeData.expiryDate || "" });
            setPaymentState("success");
            setBusy(false);
            return;
          }

          if (["failed", "cancelled", "rejected", "expired"].includes(state)) {
            throw new Error("Payment was not completed. Please try again.");
          }

          // Still pending — keep polling until timeout
          if (Date.now() - started < POLL_TIMEOUT) {
            setTimeout(poll, 4_000);
          } else {
            if (!cancelledRef.current) {
              setPaymentState("timeout");
              setMessage("Payment is still being confirmed. Your subscription will activate automatically once confirmed by our payment provider.");
              setBusy(false);
            }
          }
        } catch (e) {
          if (!cancelledRef.current) {
            setPaymentError(e instanceof Error ? e.message : "Payment check failed");
            setPaymentState("idle");
            setBusy(false);
          }
        }
      };

      setTimeout(poll, 3_000);
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Payment failed");
      setPaymentState("idle");
      setBusy(false);
    }
  };

  const resetFlow = () => {
    cancelledRef.current = true;
    setPaymentState("idle");
    setChosen(null);
    setMethod(null);
    setPhone("");
    setBusy(false);
    setMessage(null);
    setPaymentError(null);
    setActivePlan(null);
    setFriendLink(null);
    setFriendLinkCopied(false);
  };

  const createFriendLink = async () => {
    if (!chosen || friendLinkBusy) return;
    setFriendLinkBusy(true);
    setPaymentError(null);
    setFriendLinkCopied(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Please sign in before creating a payment link.");
      const response = await fetch("/api/payment/gift-link", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ planId: chosen.id }),
      });
      const result = await response.json();
      if (!response.ok || !result.token) throw new Error(result.error || "Could not create the payment link.");
      const params = new URLSearchParams({ page: "subscription", plan: String(chosen.id), gift: result.token });
      const link = `${window.location.origin}/?${params.toString()}`;
      setFriendLink(link);
      await navigator.clipboard.writeText(link);
      setFriendLinkCopied(true);
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Could not create the payment link.");
    } finally {
      setFriendLinkBusy(false);
    }
  };

  const formatExpiry = (iso: string) => {
    if (!iso) return "";
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  };

  const px = mobile ? 16 : 24;

  // ── Success screen ────────────────────────────────────────────────────────
  if (paymentState === "success" && activePlan) {
    return (
      <div style={{ minHeight:"100%", background:BG, display:"grid", placeItems:"center", paddingTop:`calc(${mobile?54:66}px + env(safe-area-inset-top,0px))`, paddingBottom:24, paddingLeft:24, paddingRight:24 }}>
        <div style={{ width:"100%", maxWidth:440, background:CARD, border:"1px solid rgba(255,255,255,.1)", borderRadius:20, paddingTop:mobile?24:32, paddingBottom:mobile?24:32, paddingLeft:mobile?24:32, paddingRight:mobile?24:32, textAlign:"center" }}>
          <div style={{ width:64, height:64, borderRadius:"50%", background:"rgba(74,222,128,.12)", border:"2px solid rgba(74,222,128,.4)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 style={{ color:"white", fontSize:22, fontWeight:800, marginBottom:8 }}>Payment Successful!</h2>
          <p style={{ color:"#94a3b8", fontSize:14, lineHeight:1.6, marginBottom:6 }}>
            Your <strong style={{ color:"white" }}>{activePlan.name}</strong> subscription is now active.
          </p>
          {activePlan.expiry && (
            <p style={{ color:"#64748b", fontSize:12, marginBottom:24 }}>
              Access until {formatExpiry(activePlan.expiry)}
            </p>
          )}
          <button
            onClick={() => { onSuccess?.(); }}
            style={{ width:"100%", padding:"13px 0", borderRadius:12, background:BLUE, border:0, color:"white", fontWeight:700, fontSize:14, cursor:"pointer", marginBottom:10 }}
          >
            Go to My Profile
          </button>
          <button
            onClick={resetFlow}
            style={{ width:"100%", padding:"10px 0", borderRadius:12, background:"transparent", border:"1px solid rgba(255,255,255,.1)", color:"#94a3b8", fontSize:13, cursor:"pointer" }}
          >
            Back to Plans
          </button>
        </div>
      </div>
    );
  }

  // ── Polling / timeout screen ──────────────────────────────────────────────
  if (paymentState === "polling" || paymentState === "timeout") {
    return (
      <div style={{ minHeight:"100%", background:BG, display:"grid", placeItems:"center", paddingTop:`calc(${mobile?54:66}px + env(safe-area-inset-top,0px))`, paddingBottom:24, paddingLeft:24, paddingRight:24 }}>
        <div style={{ width:"100%", maxWidth:440, background:CARD, border:"1px solid rgba(255,255,255,.1)", borderRadius:20, paddingTop:mobile?24:32, paddingBottom:mobile?24:32, paddingLeft:mobile?24:32, paddingRight:mobile?24:32, textAlign:"center" }}>
          {paymentState === "polling" ? (
            <div>
              <div style={{ width:56, height:56, borderRadius:"50%", border:"3px solid rgba(59,130,246,.15)", borderTopColor:BLUE, animation:"spin 0.9s linear infinite", margin:"0 auto 20px" }} />
              <h2 style={{ color:"white", fontSize:20, fontWeight:800, marginBottom:8 }}>Waiting for Confirmation</h2>
              <p style={{ color:"#94a3b8", fontSize:13, lineHeight:1.7, marginBottom:6 }}>
                A Mobile Money prompt has been sent to your phone.
                Please approve it to complete your payment.
              </p>
              <p style={{ color:"#64748b", fontSize:12, marginBottom:24 }}>
                {chosen?.name} · UGX {Number(chosen?.amount||0).toLocaleString()}
              </p>
            </div>
          ) : (
            <div>
              <div style={{ width:56, height:56, borderRadius:"50%", background:"rgba(251,191,36,.1)", border:"2px solid rgba(251,191,36,.4)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <h2 style={{ color:"white", fontSize:20, fontWeight:800, marginBottom:8 }}>Still Confirming…</h2>
              <p style={{ color:"#94a3b8", fontSize:13, lineHeight:1.7, marginBottom:24 }}>
                {message || "Your subscription will activate automatically once the payment is confirmed."}
              </p>
            </div>
          )}
          <button
            onClick={resetFlow}
            style={{ width:"100%", padding:"11px 0", borderRadius:12, background:"transparent", border:"1px solid rgba(255,255,255,.1)", color:"#94a3b8", fontSize:13, cursor:"pointer" }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Main plan selection + payment modal ───────────────────────────────────
  return <div style={{minHeight:"100%",background:BG,paddingTop:`calc(${mobile?54:66}px + env(safe-area-inset-top,0px))`,paddingBottom:80,paddingLeft:0,paddingRight:0}}>
    <div style={{maxWidth:980,margin:"0 auto",paddingTop:0,paddingBottom:0,paddingLeft:px,paddingRight:px}}>
      <div style={{textAlign:"center",margin:mobile?"32px 0 36px":"56px 0 52px"}}>
        <span style={{color:ORANGE,fontSize:11,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase"}}>Choose Your Plan</span>
        <h1 style={{fontFamily:"'Anton',sans-serif",fontSize:mobile?36:52,color:"white",marginTop:12,marginBottom:14}}>Unlimited Streaming</h1>
        <p style={{color:"#64748b",fontSize:15}}>Pick the plan that works for you and start watching today.</p>
      </div>
      {paymentError && <div style={{background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.3)",color:"#fca5a5",padding:14,borderRadius:12,marginBottom:20,textAlign:"center"}}>{paymentError}</div>}
      {message && !paymentError && <div style={{background:"rgba(59,130,246,.08)",border:"1px solid rgba(59,130,246,.25)",color:"#bfdbfe",padding:14,borderRadius:12,marginBottom:20,textAlign:"center"}}>{message}</div>}
      <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":plans.length>=3?"repeat(3,1fr)":`repeat(${Math.min(2,plans.length)},1fr)`,gap:18}}>
        {plans.map((p:any,i:number)=>{
          const isChosen = chosen?.id===p.id;
          const accentColors = [ORANGE, BLUE, "#a78bfa"];
          const accent = accentColors[i % accentColors.length];
          const isMiddle = plans.length===3 && i===1;
          return (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              aria-pressed={isChosen}
              onClick={()=>setChosen(p)}
              onKeyDown={(e)=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setChosen(p)}}}
              style={{
                background: isChosen ? `rgba(${i===0?"249,115,22":i===1?"59,130,246":"167,139,250"},.08)` : CARD,
                border: `2px solid ${isChosen ? accent : isMiddle ? "rgba(59,130,246,.28)" : "rgba(255,255,255,.07)"}`,
                borderRadius: 18,
                padding: mobile ? 20 : 28,
                cursor: "pointer",
                position: "relative",
                minHeight: mobile ? 190 : 230,
                display: "flex",
                flexDirection: "column",
                transition: "border-color .2s, background .2s",
              }}
            >
              {isMiddle && !isChosen && (
                <div style={{position:"absolute",top:-12,left:"50%",transform:"translateX(-50%)",background:"rgba(59,130,246,.9)",color:"white",borderRadius:999,padding:"4px 14px",fontSize:10,fontWeight:800,letterSpacing:".1em",whiteSpace:"nowrap"}}>
                  POPULAR
                </div>
              )}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:14}}>
                <h3 style={{color:accent,fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:".12em",margin:0}}>{p.name}</h3>
              </div>
              <div style={{color:"white",fontSize:mobile?28:36,fontWeight:800,lineHeight:1,marginBottom:4}}>
                UGX {Number(p.amount||0).toLocaleString()}
              </div>
              {(p.duration_in_hours || p.duration_in_days || p.duration) && (
                <p style={{color:"#64748b",fontSize:12,marginTop:6,marginBottom:0}}>
                  {p.duration_in_hours === 12
                    ? '12 Hours Access'
                    : p.duration_in_hours === 24
                      ? '24 Hours Access'
                      : p.duration_in_hours && p.duration_in_hours < 24
                        ? `${p.duration_in_hours} Hours Access`
                      : p.duration_in_months
                        ? `${p.duration_in_months} month${p.duration_in_months > 1 ? 's' : ''}`
                        : p.duration_in_days
                          ? `${p.duration_in_days} day${p.duration_in_days > 1 ? 's' : ''}`
                          : p.duration}
                </p>
              )}
              <button
                onClick={(e)=>{e.stopPropagation();setChosen(p)}}
                style={{
                  width:"100%",
                  marginTop:20,
                  padding:"11px 0",
                  borderRadius:12,
                  background: isChosen ? accent : "transparent",
                  border: `1px solid ${accent}`,
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 13,
                  transition: "background .2s",
                }}
              >
                {isChosen ? "✓ Selected" : "Choose Plan"}
              </button>
            </div>
          );
        })}
      </div>
      {chosen && <div className="modal-glass" style={{position:"fixed",inset:0,zIndex:120,display:"grid",placeItems:"center",paddingTop:20,paddingBottom:20,paddingLeft:20,paddingRight:20}}>
        <div style={{width:"100%",maxWidth:460,background:CARD,border:"1px solid rgba(255,255,255,.1)",borderRadius:20,paddingTop:24,paddingBottom:24,paddingLeft:24,paddingRight:24}}>
          <h2 style={{color:"white",fontSize:20,marginBottom:6}}>Choose payment method</h2>
          <p style={{color:"#64748b",fontSize:13,marginBottom:18}}>{chosen.name} · UGX {Number(chosen.amount||0).toLocaleString()}</p>
          <div style={{marginBottom:18,padding:"14px 16px",background:"rgba(59,130,246,.06)",border:"1px solid rgba(59,130,246,.16)",borderRadius:12}}>
            <p style={{color:"white",fontSize:12,fontWeight:800,margin:"0 0 9px",textTransform:"uppercase",letterSpacing:".08em"}}>Features included</p>
            {["Access All Premium Content","Download All Movies","Watch on TV, Laptop & Website","Access up to 3 devices"].map(feature=><p key={feature} style={{color:"#cbd5e1",fontSize:12,margin:"6px 0",lineHeight:1.4}}>✓ {feature}</p>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            {([["mobile_money","📱 Mobile Money"],["card","💳 Visa / Mastercard"]] as const).map(([id,label])=><button key={id} onClick={()=>setMethod(id)} style={{padding:14,borderRadius:12,border:`2px solid ${method===id?BLUE:"rgba(255,255,255,.08)"}`,background:method===id?"rgba(59,130,246,.08)":"transparent",color:"white",cursor:"pointer"}}>{label}</button>)}
          </div>
          {method === "mobile_money" && <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="07XXXXXXXX / +2567XXXXXXXX" aria-label="Mobile Money phone number" style={inputSt}/>}
          {!giftToken && <>
            <button
              onClick={createFriendLink}
              disabled={friendLinkBusy}
              style={{width:"100%",marginTop:12,padding:11,borderRadius:12,background:"rgba(249,115,22,.08)",border:`1px solid ${ORANGE}66`,color:"#fdba74",fontWeight:700,cursor:friendLinkBusy?"wait":"pointer",opacity:friendLinkBusy?0.65:1}}
            >
              {friendLinkBusy ? "Preparing link…" : "Ask a friend to pay for you"}
            </button>
            {friendLink && <div style={{marginTop:10,padding:10,borderRadius:10,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)"}}>
              <input readOnly value={friendLink} aria-label="Payment request link" onFocus={e=>e.currentTarget.select()} style={{...inputSt,width:"100%",fontSize:11,marginBottom:8}} />
              <button onClick={async()=>{await navigator.clipboard.writeText(friendLink);setFriendLinkCopied(true)}} style={{width:"100%",padding:9,border:0,borderRadius:9,background:BLUE,color:"white",fontWeight:700,cursor:"pointer",fontSize:12}}>
                {friendLinkCopied ? "Copied" : "Copy link"}
              </button>
            </div>}
          </>}
          {paymentError && <p style={{color:"#fca5a5",fontSize:12,marginTop:8,marginBottom:0}}>{paymentError}</p>}
          <button disabled={busy||!method} onClick={pay} style={{width:"100%",marginTop:14,padding:13,border:0,borderRadius:12,background:BLUE,color:"white",fontWeight:700,cursor:busy?"wait":"pointer",opacity:busy||!method?0.55:1}}>{busy?"Processing…":method==="card"?"Continue to Card Payment":"Pay with Mobile Money"}</button>
          <button onClick={()=>{setChosen(null);setMethod(null);setPaymentError(null)}} style={{width:"100%",marginTop:8,padding:10,border:0,background:"transparent",color:"#64748b",cursor:"pointer"}}>Cancel</button>
        </div>
      </div>}
    </div>
  </div>
}

// ─── Profile Page ─────────────────────────────────────────────────────────────
function ProfilePage({ user, setUser, isPremium, subscriptionPlan, myListCount, setPage, onSignOut }: { user:UserProfile; setUser:(u:UserProfile)=>void; isPremium:boolean; subscriptionPlan:string; myListCount:number; setPage:(p:Page)=>void; onSignOut:()=>void }) {
  const { mobile } = useResponsive();
  const [freeAllowance,setFreeAllowance]=useState<any>(null);
  const [referralBusy,setReferralBusy]=useState(false);
  const [referralModal,setReferralModal]=useState(false);
  const [referralLink,setReferralLink]=useState("");
  const [paymentRows,setPaymentRows]=useState<any[]>([]);
  const [subscriptionDates,setSubscriptionDates]=useState<{start:string|null;end:string|null}>({start:null,end:null});
  const [allowanceClock,setAllowanceClock]=useState(Date.now());
  useEffect(()=>{(async()=>{const {data:{session}}=await supabase.auth.getSession();if(!session?.access_token)return;const r=await fetch("/api/free-allowance",{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});if(r.ok)setFreeAllowance(await r.json())})()},[isPremium]);
  useEffect(()=>{(async()=>{const {data:{user:authUser}}=await supabase.auth.getUser();if(!authUser)return;const [{data:profile},{data:payments}]=await Promise.all([
    supabase.from("profiles").select("subscription_start_date,subscription_expiry_date").eq("id",authUser.id).maybeSingle(),
    supabase.from("subscriptions").select("id,plan_id,subscription_type,start_date,expiry_date,payment_method").eq("user_id",authUser.id).order("start_date",{ascending:false}).limit(6),
  ]);const activeProfile=profile as {subscription?:string|null;subscription_start_date?:string|null;subscription_expiry_date?:string|null}|null;const activePayment=(payments||[]).find((payment:any)=>payment.expiry_date&&new Date(payment.expiry_date)>new Date()) as {start_date?:string|null;expiry_date?:string|null}|undefined;setSubscriptionDates({start:isPremium?(activeProfile?.subscription_start_date||activePayment?.start_date||null):null,end:isPremium?(activeProfile?.subscription_expiry_date||activePayment?.expiry_date||null):null});setPaymentRows(payments||[])})()},[isPremium]);
  const formatDate=(value:string|null)=>value?new Date(value).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"}):"—";
  useEffect(()=>{const t=setInterval(()=>setAllowanceClock(Date.now()),1000);return()=>clearInterval(t)},[]);
  const formatReset=(value:any)=>{if(!value)return "00h 00m";const ms=Math.max(0,new Date(value).getTime()-allowanceClock);const h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000);return `${h}h ${String(m).padStart(2,"0")}m`};
  const [editing,     setEditing    ] = useState(false);
  const [editName,    setEditName   ] = useState(user.name);
  const [editPhone,   setEditPhone  ] = useState(user.phone);
  const [editAvatarI, setEditAvatarI] = useState(Math.max(0,AVATARS.findIndex(a=>a.emoji===user.avatar&&a.bg===user.avatarBg)));
  const [pickAvatar,  setPickAvatar ] = useState(false);
  const [confirmOut,  setConfirmOut ] = useState(false);
  const px = mobile?16:24;

  const saveChanges = () => {
    const av = AVATARS[editAvatarI];
    setUser({ ...user, name:editName, phone:editPhone, avatar:av.emoji, avatarBg:av.bg });
    setEditing(false); setPickAvatar(false);
  };

  const loadReferralLink = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return "";
    const url = `https://kilaxmovies.com/?ref=${encodeURIComponent(session.user.id)}`;
    setReferralLink(url);
    return url;
  };

  const openReferralModal = async () => {
    setReferralModal(true);
    if (!referralLink) { try { await loadReferralLink(); } catch { /* keep modal usable */ } }
  };

  const shareReferralLink = async () => {
    if (referralBusy) return;
    setReferralBusy(true);
    try {
      const url = referralLink || await loadReferralLink();
      if (!url) return;
      if (navigator.share) await navigator.share({ title:"Kilax Movies", text:"Join me on Kilax Movies and get free watches.", url });
      else { await navigator.clipboard.writeText(url); showShareToast(); }
    } catch { /* User cancelled sharing or clipboard was unavailable. */ }
    finally { setReferralBusy(false); }
  };

  const card: React.CSSProperties = { background:CARD, border:"1px solid rgba(255,255,255,0.07)", borderRadius:16, padding:mobile?"20px":"28px 32px", marginBottom:16 };

  return (
    <div style={{ paddingTop:`calc(${mobile?54:66}px + env(safe-area-inset-top,0px))`, paddingBottom:60, minHeight:"100%", background:BG }}>
      <div style={{ maxWidth:800, margin:"0 auto", padding:`0 ${px}px` }}>
        <div style={{ ...card, marginTop:24 }}>
          <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
            <div style={{ position:"relative", flexShrink:0 }}>
              <Avatar emoji={user.avatar} bg={user.avatarBg} size={mobile?64:78} ring />
              {editing && <button onClick={()=>setPickAvatar(p=>!p)} style={{ position:"absolute", bottom:-2, right:-2, width:22, height:22, borderRadius:"50%", background:BLUE, border:"2px solid #161b2e", color:"white", fontSize:10, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>✏</button>}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <h1 style={{ fontFamily:"'Anton',sans-serif", fontSize:mobile?24:30, color:"white", marginBottom:4 }}>{user.name}</h1>
              <p style={{ color:"#475569", fontSize:12 }}>Username: {user.name} · {user.email} · Since {user.joinDate}</p>
              <div style={{ marginTop:8 }}>
                {isPremium
                  ? <span style={{ background:"rgba(249,115,22,0.12)", color:ORANGE, border:"1px solid rgba(249,115,22,0.3)", borderRadius:20, padding:"5px 14px", fontSize:11, fontWeight:700 }}>{subscriptionPlan || "Current Plan"}</span>
                  : <button onClick={()=>setPage("subscription")} style={{ background:`linear-gradient(135deg,${SKYBLUE},${BLUE})`, color:"white", border:"none", borderRadius:20, padding:"6px 16px", fontSize:11, fontWeight:700, cursor:"pointer" }}>Upgrade</button>
                }
              </div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              {editing
                ? <><BlueBtn onClick={saveChanges} style={{ padding:"9px 18px", fontSize:13 }}>Save</BlueBtn><GlassBtn onClick={()=>{setEditing(false);setPickAvatar(false);}} style={{ padding:"9px 14px", fontSize:13 }}>Cancel</GlassBtn></>
                : <GlassBtn onClick={()=>setEditing(true)} style={{ padding:"9px 18px", fontSize:13 }}>Edit</GlassBtn>
              }
            </div>
          </div>
          {editing&&pickAvatar&&<div style={{ marginTop:20, paddingTop:18, borderTop:"1px solid rgba(255,255,255,0.06)" }}><AvatarPicker selected={editAvatarI} onSelect={setEditAvatarI} /></div>}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:16 }}>
          {[{label:"Saved",value:myListCount,c:ORANGE},{label:"Current Plan",value:isPremium?(subscriptionPlan||"Current Plan"):"Free User",c:BLUE},{label:"Daily Credits",value:isPremium?"Unlimited":`${Math.max(0,5-(freeAllowance?.unitsUsed??0))} / 5`,c:"#4ade80"}].map(s=>(
            <div key={s.label} style={{ ...card, textAlign:"center", marginBottom:0, padding:mobile?"14px":"20px" }}>
              <div style={{ color:s.c, fontSize:mobile?18:22, fontWeight:700, fontFamily:"'Aptos', 'Segoe UI', sans-serif", marginBottom:2 }}>{s.value}</div>
              <div style={{ color:"#64748b", fontSize:11 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <button onClick={openReferralModal} style={{ width:"100%", display:"flex", alignItems:"center", gap:16, padding:"14px 16px", marginBottom:16, borderRadius:16, border:"1px solid rgba(249,115,22,.45)", background:"#171922", color:"white", textAlign:"left", cursor:"pointer" }}>
          <span style={{ width:64, height:64, borderRadius:16, display:"grid", placeItems:"center", flexShrink:0, background:"rgba(249,115,22,.1)", border:"1px solid rgba(249,115,22,.55)" }}><Share2 size={28} color="#fbbf24" /></span>
          <span style={{ minWidth:0 }}><span style={{ display:"block", color:"white", fontSize:20, fontWeight:800, lineHeight:1.2 }}>Share &amp; Earn Free Streaming coins</span><span style={{ display:"block", color:"#93a4bd", fontSize:14, marginTop:6 }}>Every friend you bring earns you more coins no limit</span></span>
        </button>

        {referralModal && <ShareEarnModal link={referralLink} busy={referralBusy} onClose={()=>setReferralModal(false)} onShare={shareReferralLink} onCopy={async()=>{const url=referralLink||await loadReferralLink();if(url){await navigator.clipboard.writeText(url);showShareToast();}}} />}

        <div style={{ ...card, padding:0, overflow:"hidden" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, padding:"20px 20px 16px", borderBottom:"1px solid rgba(255,255,255,.07)" }}>
            <h2 style={{ color:BLUE, fontSize:16, fontWeight:800, lineHeight:1.15, margin:0, textTransform:"uppercase" }}>Today&apos;s free<br/>allowance</h2>
            <span style={{ color:"#94a3b8", fontSize:12, whiteSpace:"nowrap" }}>◷ resets in {formatReset(freeAllowance?.resetAt)}</span>
          </div>
          {isPremium ? (
            <p style={{ color:"#64748b", fontSize:12, lineHeight:1.6, margin:0, padding:20 }}>Your {subscriptionPlan || "current"} package has unlimited viewing access.</p>
          ) : (
            <div style={{ padding:"20px 20px 22px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}><span style={{ color:"#cbd5e1", fontSize:14 }}>Daily credits</span><strong style={{ color:"white", fontSize:14 }}>{Math.max(0,5-(freeAllowance?.unitsUsed??0))} / 5 remaining</strong></div>
              <div style={{ height:10, borderRadius:999, background:"rgba(255,255,255,.1)", overflow:"hidden", marginBottom:16 }}><div style={{ height:"100%", width:`${Math.max(0,Math.min(100,((5-(freeAllowance?.unitsUsed??0))/5)*100))}%`, borderRadius:999, background:BLUE, transition:"width .3s" }} /></div>
              <p style={{ color:"#94a3b8", fontSize:12, lineHeight:1.55, margin:0 }}>Each watch or download costs 5 credits. Resets daily at midnight.</p>
            </div>
          )}
        </div>

        <div style={card}>
          <h2 style={{ color:"white", fontSize:15, fontWeight:700, marginBottom:18 }}>Account Information</h2>
          {[
            {label:"Full Name",    val:editing?null:user.name,     input:<input value={editName}  onChange={e=>setEditName(e.target.value)}  style={{ ...inputSt, flex:1 }} />},
            {label:"Email",        val:user.email, input:null},
            {label:"Phone",        val:editing?null:user.phone,    input:<input value={editPhone} onChange={e=>setEditPhone(e.target.value)} style={{ ...inputSt, flex:1 }} />},
            {label:"Member Since", val:user.joinDate, input:null},
          ].map((f,i,arr)=>(
            <div key={f.label} style={{ display:"flex", alignItems:"center", gap:14, padding:"13px 0", borderBottom:i<arr.length-1?"1px solid rgba(255,255,255,0.05)":"none", flexWrap:mobile&&editing&&f.input?"wrap":"nowrap" }}>
              <div style={{ width:mobile?100:130, color:"#64748b", fontSize:12, flexShrink:0 }}>{f.label}</div>
              {editing&&f.input ? f.input : <div style={{ color:"white", fontSize:13, fontWeight:500 }}>{f.val}</div>}
            </div>
          ))}
        </div>

        <div style={card}>
          <h2 style={{ color:"white", fontSize:15, fontWeight:700, marginBottom:12 }}>Plan Dates</h2>
          <div style={{ display:"grid", gridTemplateColumns:mobile?"1fr 1fr":"repeat(2,1fr)", gap:10 }}>
            <div style={{ background:"rgba(59,130,246,.06)", border:"1px solid rgba(59,130,246,.12)", borderRadius:10, padding:12 }}><p style={{color:"#64748b",fontSize:10,margin:"0 0 4px"}}>Start date</p><p style={{color:"white",fontSize:13,fontWeight:600,margin:0}}>{isPremium?formatDate(subscriptionDates.start):"—"}</p></div>
            <div style={{ background:"rgba(249,115,22,.06)", border:"1px solid rgba(249,115,22,.12)", borderRadius:10, padding:12 }}><p style={{color:"#64748b",fontSize:10,margin:"0 0 4px"}}>End date</p><p style={{color:"white",fontSize:13,fontWeight:600,margin:0}}>{isPremium?formatDate(subscriptionDates.end):"—"}</p></div>
          </div>
        </div>

        <div style={card}>
          <h2 style={{ color:"white", fontSize:15, fontWeight:700, marginBottom:18 }}>Payment History</h2>
          <div style={{ borderRadius:10, overflow:"hidden", border:"1px solid rgba(255,255,255,0.06)" }}>
            {(paymentRows.length?paymentRows:[]).map((p,i)=>(
              <div key={p.id||i} style={{ display:"grid", gridTemplateColumns:mobile?"1fr 1fr":"1fr 1fr 1fr", gap:10, padding:"13px 14px", background:i%2===0?"rgba(255,255,255,0.015)":"transparent", borderBottom:i<paymentRows.length-1?"1px solid rgba(255,255,255,0.04)":"none" }}>
                <span style={{ color:"#94a3b8", fontSize:12 }}>{p.start_date?new Date(p.start_date).toLocaleDateString():"—"}</span>
                <span style={{ color:"#94a3b8", fontSize:12 }}>{p.subscription_type||p.payment_method||"—"}</span>
                <span style={{ color:"#4ade80", fontSize:11, fontWeight:600 }}>{p.status||"Active"}</span>
              </div>
            ))}
            {paymentRows.length===0&&<div style={{padding:"16px 14px",color:"#475569",fontSize:12}}>No completed subscription payments yet.</div>}
          </div>
        </div>

        <div style={{ ...card, borderColor:"rgba(239,68,68,0.12)" }}>
          <h2 style={{ color:"#ef4444", fontSize:14, fontWeight:700, marginBottom:6 }}>Account Actions</h2>
          <p style={{ color:"#475569", fontSize:13, marginBottom:16 }}>Signing out ends your session on this device.</p>
          {confirmOut ? (
            <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", background:"rgba(239,68,68,0.06)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:12, padding:"14px 16px" }}>
              <span style={{ color:"#cbd5e1", fontSize:13, flex:1 }}>Are you sure?</span>
              <button onClick={onSignOut} style={{ background:"#ef4444", color:"white", border:"none", borderRadius:10, padding:"9px 18px", fontSize:13, fontWeight:700, cursor:"pointer" }}>Yes, Sign Out</button>
              <button onClick={()=>setConfirmOut(false)} style={{ background:"none", color:"#64748b", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"9px 14px", fontSize:13, cursor:"pointer" }}>Cancel</button>
            </div>
          ) : (
            <button onClick={()=>setConfirmOut(true)} style={{ background:"rgba(239,68,68,0.08)", color:"#ef4444", border:"1px solid rgba(239,68,68,0.22)", borderRadius:12, padding:"11px 22px", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }} onMouseEnter={e=>(e.currentTarget.style.background="rgba(239,68,68,0.16)")} onMouseLeave={e=>(e.currentTarget.style.background="rgba(239,68,68,0.08)")}>Sign Out</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Support Panel ────────────────────────────────────────────────────────────
function SupportPanel({ onClose }: { onClose:()=>void }) {
  const { mobile } = useResponsive();
  const links = [
    { icon:<WhatsAppIcon size={19}/>, label:"Chat with Support", sub:"+256 780 846 800", href:"https://wa.me/256780846800", color:GREEN },
    { icon:"✈️", label:"Telegram Community", sub:"@kilaxmovies community", href:"https://t.me/kilaxmovies", color:"#229ED9" },
    { icon:"🎵", label:"Follow on TikTok", sub:"@kilaxmovies", href:"https://tiktok.com/@kilaxmovies", color:"#ff0050" },
  ];

  return (
    <div className="fade-up" style={{ position:"fixed", bottom:`calc(80px + env(safe-area-inset-bottom,0px))`, right:mobile?12:24, zIndex:100, width:mobile?"calc(100vw - 24px)":320, maxWidth:320, background:"#0a1628", border:"1px solid rgba(255,255,255,0.1)", borderRadius:20, boxShadow:"0 32px 80px rgba(0,0,0,0.9)", overflow:"hidden" }}>
      <div style={{ background:`linear-gradient(135deg,#128C7E,#25D366)`, padding:"16px 18px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <p style={{ color:"white", fontWeight:700, fontSize:15, margin:0 }}>Customer Support</p>
          <p style={{ color:"rgba(255,255,255,0.7)", fontSize:12, margin:0 }}>We reply within minutes</p>
        </div>
        <button onClick={onClose} style={{ background:"rgba(255,255,255,0.15)", border:"none", color:"white", borderRadius:"50%", width:28, height:28, cursor:"pointer", fontSize:13, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
      </div>
      <div style={{ padding:"12px 12px 16px" }}>
        {links.map(l=>(
          <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 10px", borderRadius:12, textDecoration:"none", transition:"background 0.18s", marginBottom:4 }}
            onMouseEnter={e=>((e.currentTarget as HTMLAnchorElement).style.background="rgba(255,255,255,0.05)")}
            onMouseLeave={e=>((e.currentTarget as HTMLAnchorElement).style.background="transparent")}
          >
            <div style={{ width:40, height:40, borderRadius:"50%", background:`${l.color}22`, border:`1px solid ${l.color}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{l.icon}</div>
            <div>
              <p style={{ color:"white", fontSize:13, fontWeight:600, margin:0 }}>{l.label}</p>
              <p style={{ color:"#64748b", fontSize:11, margin:0 }}>{l.sub}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Floating Support Button ──────────────────────────────────────────────────
function FloatingSupportBtn({ onClick }: { onClick:()=>void }) {
  return (
    <button onClick={onClick} style={{ position:"fixed", bottom:`calc(24px + env(safe-area-inset-bottom,0px))`, right:24, zIndex:99, width:56, height:56, borderRadius:"50%", background:`linear-gradient(135deg,#128C7E,${GREEN})`, border:`2px solid rgba(37,211,102,0.4)`, color:"white", fontSize:26, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:`0 8px 32px rgba(37,211,102,0.4), 0 2px 8px rgba(0,0,0,0.5)`, transition:"transform 0.2s" }}
      onMouseEnter={e=>(e.currentTarget.style.transform="scale(1.1)")}
      onMouseLeave={e=>(e.currentTarget.style.transform="scale(1)")}
    ><WhatsAppIcon size={27}/></button>
  );
}

// ─── Home Page ────────────────────────────────────────────────────────────────
function HomePage({ myList, onToggleList, onOpen, onPlay, watchHistory, onSeeMore }: { myList:Set<number>; onToggleList:(id:number)=>void; onOpen:(m:MediaItem)=>void; onPlay:(m:MediaItem)=>void; watchHistory:number[]; onSeeMore:(type:'movie'|'series', genre?:string, latest?:boolean)=>void }) {
  const { mobile } = useResponsive();
  const px = mobile?16:48;
  const movies = mediaCatalog.filter(m=>m.type === "movie");
  const series = mediaCatalog.filter(m=>m.type === "series");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.pathname !== "/") return;

    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;

    const params = new URLSearchParams(hash);
    const type = params.get("type");
    const accessToken = params.get("access_token");

    if (type === "recovery" && accessToken) {
      const nextUrl = new URL("/reset-password", window.location.origin);
      nextUrl.hash = hash;
      window.location.replace(nextUrl.toString());
    }
  }, []);

  const [trending, setTrending] = useState<MediaItem[]>([]);
  const [interacted, setInteracted] = useState(false);
  useEffect(()=>{ (async()=>{try{const r=await fetch("/api/reelplexi/trending?perPage=30",{cache:"no-store"});const d=await r.json();const mapped=(d.data||[]).map((x:any,i:number)=>({...mapReelplexiItem(x,(x.type === "series" || x.first_air_date || x.number_of_seasons != null) ? "series" : "movie",i),isTrending:true})); setTrending(mapped); for(const m of mapped){if(!mediaCatalog.some(existing=>existing.sourceId===m.sourceId)) mediaCatalog.push(m)}}catch{setTrending([])}})() },[]);
  useEffect(()=>{ const f=()=>setInteracted(true); window.addEventListener("kilax-content-interacted",f); return()=>window.removeEventListener("kilax-content-interacted",f)},[]);
  const topPickIds = useMemo(()=>{ const watched=watchHistory.map(id=>mediaCatalog.find(m=>m.id===id)).filter(Boolean) as MediaItem[]; const seen=new Set(watched.flatMap(m=>m.genres)); return mediaCatalog.filter(m=>!watchHistory.includes(m.id)&&m.genres.some(g=>seen.has(g))).sort((a,b)=>b.score-a.score).slice(0,12).map(m=>m.id); },[watchHistory]);
  const genreRows = Array.from(new Set(mediaCatalog.flatMap(m=>m.genres))).filter(g=>g.toLowerCase()!=="musical").slice(0,8).map(g=>({label:`${g}`,ids:mediaCatalog.filter(m=>m.genres.includes(g)).slice(0,12).map(m=>m.id)}));
  const rows = [
    {label:"Trending Now", icon:Flame, items:trending, see:()=>onSeeMore("movie")},
    ...(interacted||watchHistory.length>0 ? [{label:"Top Picks For You", icon:Sparkles, ids:topPickIds,see:()=>onSeeMore("movie")}]:[]),
    {label:"Latest Movies", icon:Clapperboard, ids:movies.slice(0,12).map(m=>m.id),see:()=>onSeeMore("movie",undefined,true)},
    {label:"Latest Series", icon:Tv2, ids:series.slice(0,12).map(m=>m.id),see:()=>onSeeMore("series",undefined,true)},
    ...genreRows.map(r=>({...r,see:()=>onSeeMore("movie",r.label)})),
    {label:"More Movies", icon:Film, ids:movies.slice(12,24).map(m=>m.id),see:()=>onSeeMore("movie")},
    {label:"More Series", icon:Tv2, ids:series.slice(12,24).map(m=>m.id),see:()=>onSeeMore("series")},
    {label:"More to Explore", icon:Compass, ids:mediaCatalog.slice(24,36).map(m=>m.id),see:()=>onSeeMore("movie")}
  ];
  return <>
    <HeroSlider myList={myList} onToggleList={onToggleList} onInfo={onOpen} onPlay={onPlay} />
    <div style={{marginTop:20,position:"relative",zIndex:10}}>{rows.map((r:any)=><MediaRow key={r.label} label={r.label} icon={r.icon} ids={r.ids || r.items.map((x:MediaItem)=>x.id)} myList={myList} onToggleList={onToggleList} onOpen={onOpen} onSeeMore={r.see}/>)}</div>
    <Footer />
  </>;
}

function PhoneRequiredModal({ onSaved }: { onSaved:(phone:string)=>void }) {
  const [countryCode,setCountryCode]=useState("UG"); const [phone,setPhone]=useState(""); const [busy,setBusy]=useState(false);
  const save=async()=>{const country=PHONE_COUNTRIES.find(c=>c.code===countryCode);if(!country||!isValidInternationalPhone(country.dialCode,phone)){alert("Please enter a valid phone number with the country code.");return}const normalizedPhone=normalizeInternationalPhone(country.dialCode,phone);setBusy(true);const {error}=await supabase.auth.updateUser({data:{phone:normalizedPhone}});setBusy(false);if(error)alert(error.message);else onSaved(normalizedPhone)};
  return <div style={{position:"fixed",inset:0,zIndex:210,background:"rgba(0,0,0,.82)",backdropFilter:"blur(18px)",display:"grid",placeItems:"center",padding:20}}><div style={{maxWidth:420,width:"100%",background:CARD,border:"1px solid rgba(255,255,255,.1)",borderRadius:20,padding:28}}><h2 style={{color:"white",fontSize:22,marginBottom:8}}>One more step</h2><p style={{color:"#94a3b8",fontSize:13,lineHeight:1.6,marginBottom:18}}>Please submit your phone number to continue using your Kilax Movies account.</p><PhoneNumberField countryCode={countryCode} phone={phone} onCountryChange={setCountryCode} onPhoneChange={setPhone}/><BlueBtn onClick={save} style={{width:"100%",justifyContent:"center",marginTop:14}}>{busy?"Saving…":"Continue"}</BlueBtn></div></div>;
}

function ShareEarnModal({ link, busy, onClose, onShare, onCopy }: { link:string; busy:boolean; onClose:()=>void; onShare:()=>void; onCopy:()=>void }) {
  const benefit = (icon:React.ReactNode, title:string, text:string, color:string) => <div style={{ flex:1, minWidth:0, padding:"16px 10px", borderRadius:14, background:"rgba(255,255,255,.045)", border:"1px solid rgba(255,255,255,.08)", textAlign:"center" }}><div style={{ width:44, height:44, margin:"0 auto 10px", borderRadius:"50%", display:"grid", placeItems:"center", background:`${color}22`, color }}>{icon}</div><p style={{ color:"white", fontSize:13, fontWeight:800, lineHeight:1.15, margin:"0 0 8px" }}>{title}</p><p style={{ color:"#64748b", fontSize:11, lineHeight:1.35, margin:0 }}>{text}</p></div>;
  return <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:230, background:"rgba(0,0,0,.76)", backdropFilter:"blur(14px)", display:"grid", placeItems:"center", padding:16 }}>
    <div onClick={e=>e.stopPropagation()} className="fade-up" style={{ width:"100%", maxWidth:560, maxHeight:"92vh", overflowY:"auto", background:"#171922", border:"1px solid rgba(255,255,255,.14)", borderRadius:22, boxShadow:"0 32px 100px rgba(0,0,0,.8)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:14, padding:"20px 20px 18px", borderBottom:"1px solid rgba(255,255,255,.08)" }}><div style={{ width:54, height:54, borderRadius:16, background:"rgba(249,115,22,.14)", border:"1px solid rgba(249,115,22,.42)", display:"grid", placeItems:"center" }}><Share2 size={25} color="#fbbf24" /></div><div style={{ flex:1 }}><h2 style={{ color:"white", fontSize:19, fontWeight:800, margin:0 }}>Share &amp; Earn Free Streaming Points / Coins</h2><p style={{ color:"#94a3b8", fontSize:13, margin:"4px 0 0" }}>Every friend you bring earns you more streaming points</p></div><button onClick={onClose} aria-label="Close" style={{ width:40, height:40, border:0, borderRadius:"50%", background:"rgba(255,255,255,.07)", color:"#94a3b8", cursor:"pointer", fontSize:22 }}>×</button></div>
      <div style={{ padding:"20px" }}><div style={{ textAlign:"center", marginBottom:20 }}><Gift size={42} color="#fbbf24" style={{ margin:"0 auto 10px" }} /><h2 style={{ color:"white", fontSize:25, fontWeight:800, margin:0 }}>Earn Free Credits / Coins</h2><p style={{ color:"#fbbf24", fontSize:15, fontWeight:800, margin:"8px 0 0" }}>Share to a friend and earn free Streaming coins / points</p></div><p style={{ color:"#d1d5db", fontSize:15, lineHeight:1.7, textAlign:"center", margin:"0 0 20px" }}>Every time you share a movie or series and someone opens your link, you earn <strong style={{ color:"#fbbf24" }}>5 free credits</strong> — use them to watch or download anything on Kilax.</p><div style={{ display:"grid", gap:9, marginBottom:20 }}>{["Open any movie or series","Tap the Share button","Someone opens your link","You get 5 free Coins instantly"].map((text,index)=><div key={text} style={{ display:"flex", alignItems:"center", gap:14, padding:"13px 16px", borderRadius:13, background:"rgba(255,255,255,.045)", color:"#d1d5db", fontSize:14, fontWeight:700 }}><span style={{ width:28, height:28, display:"grid", placeItems:"center", flexShrink:0, color:index===0?ORANGE:index===1?BLUE:index===2?"#c084fc":"#4ade80" }}>{index===0?<ClapperIcon size={20}/>:index===1?<Link2 size={20}/>:index===2?<Users size={20}/>:<Check size={21}/>}</span>{text}</div>)}</div><div style={{ display:"flex", gap:8, marginBottom:10, alignItems:"center" }}><input readOnly value={link || "Preparing your invite link…"} aria-label="Invite link" style={{ ...inputSt, flex:1, minWidth:0, fontSize:12, color:"#a8adba" }} /><button onClick={onCopy} aria-label="Copy invite link" style={{ width:46, height:46, minHeight:46, minWidth:46, padding:0, borderRadius:12, border:"1px solid rgba(255,255,255,.1)", background:"rgba(255,255,255,.07)", color:"#cbd5e1", cursor:"pointer", display:"grid", placeItems:"center" }}><Link2 size={16} /></button></div><button onClick={onShare} disabled={busy} style={{ width:"100%", padding:14, border:0, borderRadius:13, background:ORANGE, color:"#111827", fontSize:15, fontWeight:800, cursor:busy?"wait":"pointer" }}>{busy?"Sharing…":"Invite / Refer to a Friend "}</button></div>
    </div>
  </div>;
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const { catalog, ready: catalogReady, error: catalogError } = useCatalogLoader(allMedia);
  mediaCatalog = catalog;

  const [page,         setPage        ] = useState<Page>("home");
  const [catalogPreset, setCatalogPreset] = useState<{ type:'movie'|'series'; genre?:string; latest?:boolean }>({ type:'movie' });

  const updatePage = useCallback((nextPage: Page) => {
    setPage(nextPage);

    if (typeof window === "undefined") return;

    const routeMap: Record<Page, string> = {
      home: "/",
      movies: "/movies",
      series: "/series",
      playlist: "/playlist",
      subscription: "/subscription",
      mylist: "/mylist",
      profile: "/profile",
      history: "/history",
      getapp: "/get-app",
    };

    const nextPath = routeMap[nextPage] || "/";
    const url = new URL(window.location.href);
    url.pathname = nextPath;
    const nextUrl = `${url.pathname}${url.search}`;

    if (window.location.pathname !== nextPath || window.location.search !== url.search) {
      window.history.pushState({}, "", nextUrl);
    }
  }, []);
  const [modal,        setModal       ] = useState<MediaItem | null>(null);
  const [myList,       setMyList      ] = useState<Set<number>>(new Set());
  const [scrolled,     setScrolled    ] = useState(false);
  const [supportOpen,  setSupportOpen ] = useState(false);
  const [drawerOpen,   setDrawerOpen  ] = useState(false);
  const [isPremium,    setIsPremium   ] = useState(false);
  const [paywallItem,  setPaywall     ] = useState<MediaItem | null>(null);
  const [searchOpen,   setSearchOpen  ] = useState(false);
  const [notifOpen,    setNotifOpen   ] = useState(false);
  const [isLoggedIn,   setLoggedIn    ] = useState(false);
  const { notifications, unreadCount, markRead: markNotificationRead } = useNotifications(isLoggedIn);
  const [phoneRequired, setPhoneRequired] = useState(false);
  const [subscriptionPlan, setSubscriptionPlan] = useState("free");
  const [authModal,    setAuthModal   ] = useState<AuthMode | null>(null);
  const [videoWatch,   setVideoWatch  ] = useState<{ item:MediaItem; epIdx:number; episodes?:Episode[] } | null>(null);
  const [preparingItem, setPreparingItem] = useState<MediaItem | null>(null);
  const [freeAllowance, setFreeAllowance] = useState<any>(null);
  const [freeLimitReached, setFreeLimitReached] = useState(false);
  const [seriesDetail, setSeriesDetail] = useState<MediaItem | null>(null);
  const [watchHistory, setWatchHistory] = useState<number[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("kilax-watch-history") || "[]"); } catch { return []; }
  });
  const [user, setUser] = useState<UserProfile>({
    name:"Kilax Viewer", email:"viewer@kilaxmovies.com",
    phone:"+256 780 846 800",
    joinDate:new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}),
    avatar:DEFAULT_AVATAR.emoji, avatarBg:DEFAULT_AVATAR.bg,
  });

  useEffect(()=>{
    if (typeof window === "undefined") return;

    const syncPageFromUrl = () => {
      const pathname = window.location.pathname;
      const nextPage = pathname === "/movies" ? "movies"
        : pathname === "/series" ? "series"
        : pathname === "/playlist" ? "playlist"
        : pathname === "/subscription" ? "subscription"
        : pathname === "/mylist" ? "mylist"
        : pathname === "/profile" ? "profile"
        : pathname === "/history" ? "history"
        : pathname === "/get-app" ? "getapp"
        : "home";

      setPage(nextPage);
    };

    syncPageFromUrl();
    window.addEventListener("popstate", syncPageFromUrl);
    return () => window.removeEventListener("popstate", syncPageFromUrl);
  }, []);

  useEffect(() => {
    try { localStorage.setItem("kilax-watch-history", JSON.stringify(watchHistory)); } catch { /* storage is optional */ }
  }, [watchHistory]);

  // ── Referral redemption + device ID ─────────────────────────────────────────
  useEffect(()=>{
    if (typeof window === "undefined") return;
    const params  = new URLSearchParams(window.location.search);
    const refCode = params.get("ref");

    // Persist ref code in sessionStorage so it survives to post-login
    if (refCode) sessionStorage.setItem("kilax_ref", refCode);

    (async () => {
      try {
        // Register device ID — import lazily to avoid SSR issues
        const { getDeviceId, getDeviceLabel } = await import("@/lib/deviceId");
        const deviceId = await getDeviceId();
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.access_token) {
          const storedRef = refCode || sessionStorage.getItem("kilax_ref");

          // Redeem referral if present
          if (storedRef) {
            await fetch("/api/referral/redeem", {
              method:  "POST",
              headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
              body:    JSON.stringify({ refCode: storedRef, deviceId }),
            });
            sessionStorage.removeItem("kilax_ref");
          }

          // Register device against this user
          await fetch("/api/referral/device", {
            method:  "POST",
            headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
            body:    JSON.stringify({ deviceId, deviceName: getDeviceLabel() }),
          }).catch(()=>{});
        }
      } catch { /* non-critical */ }
    })();
  }, []);

  useEffect(()=>{
    let alive=true;
    const sync=async()=>{ const {data:{user:authUser}}=await supabase.auth.getUser(); if(!alive) return; setLoggedIn(!!authUser); if(authUser){ const phone=authUser.user_metadata?.phone||""; setUser(u=>({...u,name:authUser.user_metadata?.full_name||u.name,email:authUser.email||u.email,phone:phone||u.phone})); if(!phone) setPhoneRequired(true); } };
    sync(); const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>sync()); return()=>{alive=false;subscription.unsubscribe()};
  },[]);


  const refreshSubscription = useCallback(async()=>{ const {data:{session}}=await supabase.auth.getSession(); if(!session?.access_token) return; try{const r=await fetch("/api/subscription/status",{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"}); if(r.ok){const d=await r.json();setSubscriptionPlan(d.plan||"free");setIsPremium(!!d.isActive);}}catch{} },[]);
  useEffect(()=>{refreshSubscription()},[refreshSubscription,isLoggedIn]);
  const refreshFreeAllowance = useCallback(async()=>{ const {data:{session}}=await supabase.auth.getSession(); if(!session?.access_token) return; try{const r=await fetch("/api/free-allowance",{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"}); if(r.ok)setFreeAllowance(await r.json());}catch{} },[]);
  useEffect(()=>{if(isLoggedIn&&!isPremium)refreshFreeAllowance()},[isLoggedIn,isPremium,refreshFreeAllowance]);

  const requireAuth = useCallback((then:()=>void) => {
    if (isLoggedIn) { then(); } else { setAuthModal("login"); }
  }, [isLoggedIn]);

  const openCatalogPreset = (type:'movie'|'series', genre?:string, latest?:boolean) => {
    setCatalogPreset({ type, genre, latest });
    updatePage(type === 'movie' ? 'movies' : 'series');
  };

  const toggleList = (id:number) => requireAuth(()=>{
    setMyList(prev=>{ const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });
  });

  const handlePlay = useCallback((item:MediaItem, epIdx=0) => requireAuth(async ()=>{
    window.dispatchEvent(new Event("kilax-content-interacted"));
    if (item.premium && !isPremium) { setPaywall(item); return; }
    if (!isPremium && (item.isLatest || item.isTrending)) { setPaywall(item); return; }
    if (!isPremium) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { setAuthModal("login"); return; }
      const allowanceResponse = await fetch("/api/free-allowance", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ contentType: item.type, contentId: item.sourceId || String(item.id) }),
      });
      const allowanceResult = await allowanceResponse.json().catch(() => ({}));
      if (!allowanceResponse.ok) { setFreeAllowance(allowanceResult.allowance || freeAllowance); setPaywall(item); return; }
      setFreeAllowance(allowanceResult.allowance);
    }
    setPreparingItem(item);
    setModal(null);
    setSeriesDetail(null);
    setWatchHistory(h=>{ const next=[item.id,...h.filter(id=>id!==item.id)]; return next.slice(0,50); });
    if (item.type === "movie" && item.sourceId) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const r = await fetch(`/api/reelplexi/stream?type=movie&id=${encodeURIComponent(item.sourceId)}`, {
          cache: "no-store",
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
        });
        const data = await r.json();
        const source = data.video_url || data.stream_url || data.proxy_url || data.embed_url || data.embedUrl;
        if (!r.ok || !source) {
          if (data.limitReached || data.code) {
            setFreeLimitReached(true);
            setPreparingItem(null);
            return;
          }
          throw new Error(data.error || "Video stream unavailable");
        }
        setVideoWatch({ item: {...item, embedUrl: source}, epIdx });
        setPreparingItem(null);
        return;
      } catch (e) { console.error("Movie stream resolution failed", e); }
    }
    if (item.type === "series" && item.sourceId) {
      try {
        const r = await fetch(`/api/reelplexi/series/${encodeURIComponent(item.sourceId)}/episodes?season=1`, {cache:"force-cache"});
        const data = await r.json();
        const mappedEpisodes: Episode[] = (data.episodes || []).map((ep:any) => ({
          season: 1,
          ep: Number(ep.episode_number),
          title: ep.title || ep.name || `Episode ${ep.episode_number}`,
          duration: ep.runtime ? `${ep.runtime}m` : "",
          description: ep.overview || ep.description || "",
          thumbnail: ep.thumbnail_url || ep.poster_url || item.image,
          videoUrl: ep.video_url || ep.stream_url || ep.proxy_url || ep.embed_url || "",
        }));
        if (mappedEpisodes.length) {
          setVideoWatch({ item, epIdx: Math.min(epIdx, mappedEpisodes.length - 1), episodes: mappedEpisodes });
          setPreparingItem(null);
          return;
        }
      } catch (e) { console.error("Series stream resolution failed", e); }
    }
    setVideoWatch({ item, epIdx });
    setPreparingItem(null);
  }), [requireAuth, isPremium, freeAllowance]);

  const watchEpisodes = videoWatch?.episodes;

  const handleAuthSuccess = (u:UserProfile) => { setUser(u); setLoggedIn(true); setAuthModal(null); setPhoneRequired(!u.phone); refreshSubscription(); };

  const handleSignOut = () => {
    setLoggedIn(false); setMyList(new Set()); updatePage("home");
    setUser({ name:"Kilax Viewer", email:"viewer@kilaxmovies.com", phone:"+256 780 846 800", joinDate:new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}), avatar:DEFAULT_AVATAR.emoji, avatarBg:DEFAULT_AVATAR.bg });
  };

  const handleViewSeries = (item:MediaItem) => { setModal(null); setSeriesDetail(item); };
  useEffect(()=>{ const f=()=>setSearchOpen(true); const sub=()=>updatePage("subscription"); window.addEventListener("kilax-open-search",f); window.addEventListener("kilax-open-subscription",sub); return()=>{window.removeEventListener("kilax-open-search",f);window.removeEventListener("kilax-open-subscription",sub)}}, [updatePage]);

  if (!catalogReady) return <div style={{ minHeight:"100vh", background:BG, color:"white", display:"grid", placeItems:"center", fontFamily:"'DM Sans',sans-serif" }}><LoadingBars label="Loading Kilax Movies" /></div>;
  if (catalogError) return <div style={{ minHeight:"100vh", background:BG, color:"white", display:"grid", placeItems:"center", padding:24, textAlign:"center", fontFamily:"'DM Sans',sans-serif" }}><div><h1 style={{fontSize:22,marginBottom:10}}>Kilax Movies</h1><p style={{color:"#94a3b8",maxWidth:520}}>{catalogError}</p></div></div>;

  return (
    <div style={{ width:"100%", height:"100%", overflow:"hidden", background:BG, position:"relative" }}>
      <RecaptchaGuard />
      <OneSignalPrompt />
      {videoWatch && (
        <HomeVideoPlayer
          item={videoWatch.item}
          episodes={watchEpisodes}
          initialEpisodeIndex={videoWatch.epIdx}
          onClose={()=>setVideoWatch(null)}
          onReady={()=>setPreparingItem(null)}
          freeLimitSeconds={!isPremium ? (freeAllowance?.watchLimitSeconds ?? 1800) : undefined}
          onLimitReached={()=>{ setVideoWatch(null); setFreeLimitReached(true); refreshFreeAllowance(); }}
          onBack={()=>{
            setVideoWatch(null);
            if (videoWatch.item.type === "series") {
              setSeriesDetail(videoWatch.item);
            } else {
              setModal(videoWatch.item);
            }
          }}
        />
      )}
      {preparingItem && !videoWatch && <div style={{ position:"fixed", inset:0, zIndex:199, background:"#000", display:"grid", placeItems:"center", color:"white", textAlign:"center" }}>
        <div><div className="spin" style={{ width:42, height:42, border:"3px solid rgba(255,255,255,.2)", borderTopColor:ORANGE, borderRadius:"50%", margin:"0 auto 18px" }} /><p style={{ margin:0, fontSize:16, fontWeight:700 }}>Kilax is preparing your video...</p></div>
      </div>}

      {seriesDetail && (
        <SeriesDetailPage
          series={seriesDetail}
          onClose={()=>setSeriesDetail(null)}
          onWatch={epIdx=>handlePlay(seriesDetail, epIdx)}
        />
      )}

      <Drawer
        open={drawerOpen} onClose={()=>setDrawerOpen(false)}
        page={page} setPage={updatePage}
        isLoggedIn={isLoggedIn} user={user} onAuthOpen={m=>setAuthModal(m)}
      />

      <Navbar
        page={page} setPage={updatePage} scrolled={scrolled}
        myListCount={myList.size}
        onSearch={()=>{ setSearchOpen(o=>!o); setNotifOpen(false); }}
        onNotif={()=>{ setNotifOpen(o=>!o); setSearchOpen(false); }}
        unreadCount={unreadCount} user={user}
        isLoggedIn={isLoggedIn} onAuthOpen={m=>setAuthModal(m)}
        onDrawer={()=>setDrawerOpen(o=>!o)}
      />

      <div style={{ height:"100%", overflowY:"auto" }}
        onScroll={e=>{ setScrolled(e.currentTarget.scrollTop>60); setNotifOpen(false); }}>
        {page==="home"         && <HomePage         myList={myList} onToggleList={toggleList} onOpen={m=>setModal(m)} onPlay={handlePlay} watchHistory={watchHistory} onSeeMore={openCatalogPreset} />}
        {page==="movies"       && <CatalogPage      type="movie" title={catalogPreset.latest ? "Latest Movies" : catalogPreset.genre ? `${catalogPreset.genre} Movies` : "Movies"} accentColor={BLUE} myList={myList} onToggleList={toggleList} onOpen={m=>setModal(m)} initialGenre={catalogPreset.genre || "All"} initialFilter={catalogPreset.latest ? "latest" : "all"} />}
        {page==="series"       && <CatalogPage      type="series" title={catalogPreset.latest ? "Latest Series" : catalogPreset.genre ? `${catalogPreset.genre} Series` : "Series"} accentColor={ORANGE} myList={myList} onToggleList={toggleList} onOpen={m=>setModal(m)} initialGenre={catalogPreset.genre || "All"} initialFilter={catalogPreset.latest ? "latest" : "all"} />}
        {page==="playlist"     && <PlaylistsPage     onOpen={m=>setModal(m)} />}
        {page==="subscription" && <SubscriptionPage onSuccess={()=>{setIsPremium(true);refreshSubscription();updatePage("profile");}} />}
        {page==="mylist"       && <MyListPage       myList={myList} onToggleList={toggleList} onOpen={m=>setModal(m)} />}
        {page==="profile"      && <ProfilePage      user={user} setUser={setUser} isPremium={isPremium} subscriptionPlan={subscriptionPlan} myListCount={myList.size} setPage={updatePage} onSignOut={handleSignOut} />}
        {page==="history"      && <HistoryPage      history={watchHistory} onOpen={m=>setModal(m)} onClear={()=>setWatchHistory([])} />}
        {page==="getapp"       && <GetAppPage />}
      </div>

      {searchOpen   && <SearchOverlay      onClose={()=>setSearchOpen(false)} onOpen={m=>{ setModal(m); setSearchOpen(false); }} />}
      {notifOpen    && <NotificationsPanel onClose={()=>setNotifOpen(false)} notifs={notifications} onRead={markNotificationRead} />}
      {modal        && <DetailModal        item={modal} myList={myList} onToggleList={toggleList} onClose={()=>setModal(null)} onPlay={handlePlay} onViewSeries={handleViewSeries} />}
      {paywallItem  && <PremiumPaywall     item={paywallItem} onClose={()=>setPaywall(null)} onUpgrade={()=>{ setPaywall(null); updatePage("subscription"); }} />}
      {freeLimitReached && <FreeAllowanceLimitModal onClose={()=>setFreeLimitReached(false)} onUpgrade={()=>{ setFreeLimitReached(false); updatePage("subscription"); }} />}
      {authModal    && <AuthModal          initialMode={authModal} onSuccess={handleAuthSuccess} onClose={()=>setAuthModal(null)} />}
      {phoneRequired && isLoggedIn && <PhoneRequiredModal onSaved={(phone)=>{setUser(u=>({...u,phone}));setPhoneRequired(false)}} />}

      {supportOpen && <SupportPanel onClose={()=>setSupportOpen(false)} />}
      <FloatingSupportBtn onClick={()=>setSupportOpen(o=>!o)} />
    </div>
  );
}
