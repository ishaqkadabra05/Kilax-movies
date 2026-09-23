export default function ContactPage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#05070b", color: "white", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 720, background: "rgba(15, 23, 42, 0.9)", border: "1px solid rgba(148, 163, 184, 0.18)", borderRadius: 24, padding: 32 }}>
        <p style={{ margin: 0, color: "#fbbf24", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", fontSize: 11 }}>Contact</p>
        <h1 style={{ margin: "12px 0 10px", fontSize: "clamp(2rem, 5vw, 3rem)", lineHeight: 1.1 }}>Talk to the Kilax team</h1>
        <p style={{ margin: 0, color: "#cbd5e1", fontSize: 16, lineHeight: 1.7 }}>
          Need help with billing, streaming access, account recovery, or device setup? Reach out to us and we’ll get back to you as quickly as possible.
        </p>

        <div style={{ display: "grid", gap: 16, marginTop: 28 }}>
          <a href="https://wa.me/256780846800?text=Hello%20Kilax%20Movies%2C%20I%20need%20help" target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "14px 18px", borderRadius: 14, background: "#25D366", color: "#08150d", fontWeight: 800, textDecoration: "none" }}>
            Chat on WhatsApp
          </a>
          <a href="tel:+256744862843" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "14px 18px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.15)", color: "white", textDecoration: "none", fontWeight: 700 }}>
            Call +256 744 862 843
          </a>
          <a href="/" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "14px 18px", borderRadius: 14, background: "rgba(59,130,246,0.15)", border: "1px solid rgba(96,165,250,0.3)", color: "#bfdbfe", textDecoration: "none", fontWeight: 700 }}>
            Back to home
          </a>
        </div>
      </div>
    </main>
  );
}
