"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { signOut } from "@/lib/auth";
import { setRedirectCookie } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";
import PremiumUpgradeModal from "@/components/PremiumUpgradeModal";
import { dicebearAvatar } from "@/lib/avatar";
import {
  Search,
  Home,
  Film,
  Tv2,
  Globe,
  Smartphone,
  User,
  CreditCard,
  LogOut,
  LogIn,
  Sun,
  Moon,
  Monitor,
  ChevronDown,
  Star,
  X,
  Menu,
} from "lucide-react";

/* ── nav items ──────────────────────────────────────────────── */
const leftNavItems = [
  { href: "/non-translated", label: "Non Translated", icon: Globe },
];

/* ── theme option list ──────────────────────────────────────── */
const themeOptions = [
  { value: "light",  label: "Light",  Icon: Sun     },
  { value: "dark",   label: "Dark",   Icon: Moon    },
  { value: "system", label: "System", Icon: Monitor },
] as const;

/* ── helpers ────────────────────────────────────────────────── */
function Avatar({
  user, isPremium, size = 40,
}: { user: any; isPremium: boolean; size?: number }) {
  const s = `w-${size === 32 ? 8 : 10} h-${size === 32 ? 8 : 10}`;
  const avatarUrl = user.user_metadata?.avatar_url || dicebearAvatar(user.id || user.email || "kilax-user");
  return (
    <Image
      src={avatarUrl}
      alt="Profile"
      width={size} height={size}
      className={`${s} rounded-full border-2 ${isPremium ? "border-orange-400" : "border-orange-500"}`}
    />
  );
}

/* ══════════════════════════════════════════════════════════════
   HEADER
══════════════════════════════════════════════════════════════ */
export default function Header() {
  const pathname = usePathname();
  const { user, loading, isPremium } = useAuth();
  const { theme, setTheme } = useTheme();

  const [isMenuOpen,  setIsMenuOpen]  = useState(false);
  const [isScrolled,  setIsScrolled]  = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  const isActive = (href: string) => pathname === href;

  const handleSignOut = async () => {
    await signOut();
    setShowUserMenu(false);
    setIsMenuOpen(false);
  };

  /* scroll shadow */
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Escape key */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setIsMenuOpen(false); setShowUserMenu(false); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /* click-outside for desktop user menu */
  useEffect(() => {
    if (!showUserMenu) return;
    const onClick = (e: MouseEvent) => {
      if (!(e.target as Element).closest("[data-user-menu]")) setShowUserMenu(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [showUserMenu]);

  /* lock body scroll when drawer open */
  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isMenuOpen]);

  return (
    <>
      {/* ── top bar ─────────────────────────────────────────── */}
      <header className={`fixed top-0 inset-x-0 transition-all duration-300 border-b ${
        isScrolled
          ? "bg-black/95 backdrop-blur-md shadow-lg border-white/10"
          : "bg-[#05070e]/90 backdrop-blur-sm border-white/5"
      }`} style={{ zIndex: 40 }}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">

          {/* LEFT — logo + desktop nav */}
          <div className="flex items-center gap-4">
            {/* Desktop logo */}
            <Link href="/" className="hidden lg:flex items-center gap-2">
              <Image src="/logo.png" alt="Kilax" width={36} height={36}
                className="w-9 h-9 object-contain rounded-lg" priority />
            </Link>

            {/* Mobile: user avatar OR sign-in */}
            <div className="flex items-center lg:hidden">
              {loading ? (
                <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              ) : user ? (
                <div className="relative" data-user-menu>
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="relative rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500"
                    aria-label="User menu"
                  >
                    <Avatar user={user} isPremium={isPremium} />
                    {isPremium && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-400 rounded-full flex items-center justify-center">
                        <Star className="w-2.5 h-2.5 text-white fill-white" />
                      </span>
                    )}
                  </button>

                  {/* Mobile user mini-dropdown */}
                  {showUserMenu && (
                    <div className="absolute left-0 top-14 w-64 bg-[#1a1f2e] rounded-2xl shadow-2xl border border-white/10 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
                        <Avatar user={user} isPremium={isPremium} size={40} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {user.user_metadata?.full_name || "User"}
                          </p>
                          <p className="text-xs text-gray-400 truncate">{user.email}</p>
                          {isPremium && <p className="text-xs text-orange-400 font-medium mt-0.5">✦ Premium</p>}
                        </div>
                      </div>
                      <Link href="/profile" onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-orange-400 hover:bg-white/5 transition-colors">
                        <User className="w-4 h-4" /> Profile
                      </Link>
                      <Link href="/payment" onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-orange-400 hover:bg-white/5 transition-colors">
                        <CreditCard className="w-4 h-4" /> {isPremium ? "Manage Plan" : "Get Premium"}
                      </Link>
                      <button onClick={handleSignOut}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-red-400 hover:bg-white/5 transition-colors">
                        <LogOut className="w-4 h-4" /> Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link href="/signin" onClick={() => setRedirectCookie(pathname)}
                  className="w-10 h-10 bg-orange-500 hover:bg-orange-600 text-white rounded-full flex items-center justify-center transition-colors"
                  aria-label="Sign In">
                  <LogIn className="w-5 h-5" />
                </Link>
              )}
            </div>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-1">
              {leftNavItems.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href}
                  className={`relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 group ${
                    isActive(href)
                      ? "text-orange-500 bg-white/5"
                      : "text-gray-300 hover:text-orange-400 hover:bg-white/5"
                  }`}>
                  <Icon className="w-4 h-4" />
                  {label}
                  {isActive(href) && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-orange-500 rounded-full" />
                  )}
                </Link>
              ))}
              <Link href="/download"
                className={`relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 group ${
                  isActive("/download")
                    ? "text-orange-500 bg-white/5"
                    : "text-gray-300 hover:text-orange-400 hover:bg-white/5"
                }`}>
                <Smartphone className="w-4 h-4" />
                Get App
              </Link>
            </nav>
          </div>

          {/* SPACER */}
          <div className="flex-1" />

          {/* RIGHT — desktop */}
          <nav className="hidden lg:flex items-center gap-2">
            <Link href="/search"
              className="p-2.5 rounded-xl hover:bg-white/8 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
              aria-label="Search">
              <Search className="w-5 h-5 text-gray-300 hover:text-orange-400 transition-colors" />
            </Link>

            {loading ? (
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            ) : user ? (
              <>
                {!isPremium && (
                  <Link href="/payment"
                    className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-sm font-semibold rounded-full transition-all duration-200 hover:scale-105 shadow-lg shadow-orange-500/20">
                    <Star className="w-3.5 h-3.5 fill-white" />
                    Get Premium
                  </Link>
                )}

                <div className="relative" data-user-menu>
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-white/8 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500">
                    <Avatar user={user} isPremium={isPremium} size={32} />
                    <div className="flex flex-col items-start">
                      <span className="text-gray-300 text-sm max-w-28 truncate">
                        {user.user_metadata?.full_name || user.email}
                      </span>
                      {isPremium && <span className="text-xs text-orange-400 font-medium">Premium</span>}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showUserMenu ? "rotate-180" : ""}`} />
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-56 bg-[#1a1f2e] rounded-2xl shadow-2xl border border-white/10 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="px-4 py-3 border-b border-white/10">
                        <p className="text-xs text-gray-400">Signed in as</p>
                        <p className="text-sm font-semibold text-white truncate">{user.email}</p>
                        {isPremium && <p className="text-xs text-orange-400 font-medium mt-0.5">✦ Premium Member</p>}
                      </div>
                      <Link href="/profile" onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:text-orange-400 hover:bg-white/5 transition-colors">
                        <User className="w-4 h-4" /> Profile
                      </Link>
                      <button onClick={() => { setShowUserMenu(false); setShowPremiumModal(true); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:text-orange-400 hover:bg-white/5 transition-colors">
                        <CreditCard className="w-4 h-4" /> Make Payment
                      </button>
                      <button onClick={handleSignOut}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:text-red-400 hover:bg-white/5 transition-colors">
                        <LogOut className="w-4 h-4" /> Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Link href="/signin" onClick={() => setRedirectCookie(pathname)}
                className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-full transition-all duration-200 hover:scale-105">
                Sign In
              </Link>
            )}
          </nav>

          {/* MOBILE RIGHT — search + hamburger */}
          <div className="flex items-center gap-1 lg:hidden">
            <Link href="/search"
              className="p-2.5 rounded-xl hover:bg-white/8 transition-colors"
              aria-label="Search">
              <Search className="w-5 h-5 text-gray-300" />
            </Link>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2.5 rounded-xl hover:bg-white/8 transition-colors"
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}>
              {isMenuOpen
                ? <X className="w-5 h-5 text-gray-300" />
                : <Menu className="w-5 h-5 text-gray-300" />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile Drawer overlay ────────────────────────────── */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 lg:hidden"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", zIndex: 55 }}
          onClick={() => setIsMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile Drawer panel ──────────────────────────────── */}
      <div
        className={`fixed top-0 right-0 h-full w-72 lg:hidden flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${isMenuOpen ? "translate-x-0" : "translate-x-full"}`}
        style={{ background: "#0d1120", borderLeft: "1px solid rgba(255,255,255,0.10)", zIndex: 60 }}
        role="dialog" aria-modal="true" aria-label="Navigation menu"
      >

        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <Link href="/" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Kilax" width={32} height={32}
              className="w-8 h-8 object-contain rounded-lg" />
            <span className="text-white font-bold text-base tracking-wide">Kilax</span>
          </Link>
          <button onClick={() => setIsMenuOpen(false)}
            className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto py-3 px-3 flex flex-col gap-1">

          {/* Home */}
          <DrawerLink href="/" icon={Home} label="Home" active={isActive("/")} onClick={() => setIsMenuOpen(false)} />

          {/* Main nav */}
          {leftNavItems.map(({ href, label, icon }) => (
            <DrawerLink key={href} href={href} icon={icon} label={label}
              active={isActive(href)} onClick={() => setIsMenuOpen(false)} />
          ))}

          {/* Get App */}
          <DrawerLink href="/download" icon={Smartphone} label="Get App"
            active={isActive("/download")} onClick={() => setIsMenuOpen(false)}
            badge="New" />

          {/* Divider */}
          <div className="my-2 border-t border-gray-800" />

          {/* Theme selector */}
          <div className="px-2 pb-1">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-3 px-1">
              Appearance
            </p>
            <div className="grid grid-cols-3 gap-2">
              {themeOptions.map(({ value, label, Icon }) => {
                const isSelected = theme === value;
                return (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    style={{
                      background: isSelected ? "rgba(249,115,22,0.18)" : "rgba(255,255,255,0.06)",
                      border: isSelected ? "1.5px solid rgba(249,115,22,0.55)" : "1.5px solid rgba(255,255,255,0.10)",
                      color: isSelected ? "#fb923c" : "#9ca3af",
                    }}
                    className="flex flex-col items-center gap-2 py-3 px-1 rounded-xl text-xs font-semibold transition-all duration-150 active:scale-95"
                  >
                    <Icon
                      style={{ color: isSelected ? "#fb923c" : "#6b7280" }}
                      className="w-5 h-5"
                    />
                    {label}
                    {isSelected && (
                      <span
                        style={{ background: "#fb923c" }}
                        className="w-1 h-1 rounded-full"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="my-2 border-t border-gray-800" />

          {/* Auth section */}
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : user ? (
            <>
              {/* User card */}
              <div
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
                className="mx-2 p-3 rounded-2xl flex items-center gap-3 mb-1"
              >
                <Avatar user={user} isPremium={isPremium} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {user.user_metadata?.full_name || "User"}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  {isPremium && <p className="text-xs text-orange-400 font-medium mt-0.5">✦ Premium</p>}
                </div>
              </div>

              <DrawerLink href="/profile" icon={User} label="Profile"
                active={isActive("/profile")} onClick={() => setIsMenuOpen(false)} />
              <DrawerLink href="/payment" icon={CreditCard}
                label={isPremium ? "Manage Plan" : "Get Premium"}
                active={isActive("/payment")} onClick={() => setIsMenuOpen(false)}
                highlight={!isPremium} />

              <button onClick={handleSignOut}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-gray-400 hover:text-red-400 transition-all duration-150 w-full mt-1"
                style={{ background: "transparent" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <span
                  style={{ background: "rgba(239,68,68,0.10)" }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                >
                  <LogOut className="w-4 h-4 text-red-400" />
                </span>
                Sign Out
              </button>
            </>
          ) : (
            <Link href="/signin" onClick={() => { setIsMenuOpen(false); setRedirectCookie(pathname); }}
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-150"
              style={{ background: "rgba(249,115,22,0.10)", color: "#fb923c" }}
            >
              <span
                style={{ background: "rgba(249,115,22,0.20)" }}
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              >
                <LogIn className="w-4 h-4 text-orange-400" />
              </span>
              Sign In
            </Link>
          )}
        </div>

        {/* Drawer footer */}
        <div className="px-5 py-4 border-t border-white/8">
          <p className="text-xs text-gray-600 text-center">
            Kilax Movies · Your Entertainment Hub
          </p>
        </div>
      </div>

      {/* spacer so content isn't hidden under fixed header */}
      <div className="h-14 sm:h-16" />

      <PremiumUpgradeModal isOpen={showPremiumModal} onClose={() => setShowPremiumModal(false)} />
    </>
  );
}

/* ── reusable drawer link ───────────────────────────────────── */
function DrawerLink({
  href, icon: Icon, label, active, onClick, badge, highlight,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: string;
  highlight?: boolean;
}) {
  const rowStyle: React.CSSProperties = {
    background: active
      ? "rgba(249,115,22,0.12)"
      : "transparent",
    border: active
      ? "1px solid rgba(249,115,22,0.28)"
      : "1px solid transparent",
    color: active || highlight ? "#fb923c" : "#d1d5db",
  };

  const iconBubbleStyle: React.CSSProperties = {
    background: active
      ? "rgba(249,115,22,0.20)"
      : highlight
        ? "rgba(249,115,22,0.12)"
        : "rgba(255,255,255,0.07)",
  };

  return (
    <Link
      href={href}
      onClick={onClick}
      style={rowStyle}
      className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-150 hover:opacity-90"
    >
      <span
        style={iconBubbleStyle}
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
      >
        <Icon
          style={{ color: active || highlight ? "#fb923c" : "#9ca3af" }}
          className="w-4 h-4"
        />
      </span>
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="text-[10px] font-bold bg-orange-500 text-white px-1.5 py-0.5 rounded-full">
          {badge}
        </span>
      )}
      {active && (
        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
      )}
    </Link>
  );
}
