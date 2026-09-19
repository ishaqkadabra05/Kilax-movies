"use client";
import { MessageCircle, Phone, ShieldCheck, Download } from "lucide-react";

const whatsappNumber = "256780846800";
const whatsappMessage = encodeURIComponent("hey there kilax team i need some help in using the kilax movies website");
const playStoreUrl = "https://play.google.com/store/apps/details?id=com.app.kilax";

export default function Footer() {
  return <footer className="site-footer border-t border-white/10 bg-[#080c14] text-white">
    <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 md:grid-cols-4">
      <div><div className="mb-4"><img src="/logo.png" alt="Kilax Movies" className="h-9 w-auto" /></div><p className="text-xs leading-6 text-slate-500">Kilax Movies brings movies and series together with a clean, reliable streaming experience.</p></div>
      <div><h3 className="mb-4 text-sm font-bold">Support</h3><div className="grid gap-3 text-xs text-slate-500"><span>Help Center</span><span>Terms of Service</span><span>Privacy & Security</span><span className="inline-flex items-center gap-2"><ShieldCheck size={14}/> Secure streaming • payment gateways</span></div></div>
      <div><h3 className="mb-4 text-sm font-bold">Contact us</h3><div className="grid gap-3 text-xs"><a className="inline-flex items-center gap-2 text-[#25D366]" href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={16}/> Talk on WhatsApp</a><a className="inline-flex items-center gap-2 text-slate-300" href="tel:+256744862843"><Phone size={16}/> Tap to Contact us</a><p className="text-[10px] leading-5 text-slate-600">WhatsApp: +256 780 846 800 · Calls: +256 744 862 843</p></div></div>
      <div><h3 className="mb-4 text-sm font-bold">Downloads</h3><a href={playStoreUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-3.5 py-2.5 text-xs font-bold hover:border-blue-400/40 hover:bg-slate-800 transition"><Download size={16}/> Get Kilax Movies App</a><p className="mt-3 text-[10px] leading-5 text-slate-600">Download the official Kilax Movies app from Google Play.</p></div>
    </div>
    <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3 border-t border-white/5 px-6 py-4 text-[11px] text-slate-700"><span>© {new Date().getFullYear()} Kilax Movies. All Rights Reserved.</span><span>Secure streaming • payment gateways</span></div>
  </footer>;
}
