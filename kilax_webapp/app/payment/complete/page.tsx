"use client"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

type Stage = "checking" | "success" | "timeout" | "error"

export default function PaymentCompletePage() {
  const router = useRouter()
  const [stage, setStage]   = useState<Stage>("checking")
  const [message, setMessage] = useState("Confirming your payment…")
  const [plan, setPlan]       = useState("")
  const [expiry, setExpiry]   = useState("")
  const cancelRef = useRef(false)

  useEffect(() => {
    cancelRef.current = false
    const params       = new URLSearchParams(window.location.search)
    let transactionId  = params.get("transactionId") || ""
    let reference      = params.get("reference")      || ""
    const planParam    = params.get("plan")            || ""
    const durationParam = params.get("duration")
    const giftToken    = params.get("gift") || ""
    const providerStatus = (params.get("status") || params.get("payment_status") || params.get("transaction_status") || "").toLowerCase()
    const providerError = params.get("error") || params.get("message") || params.get("reason") || ""

    if (["failed", "cancelled", "rejected", "declined", "expired"].includes(providerStatus)) {
      setMessage(providerError || `Payment was not completed (status: ${providerStatus}). Please try again.`)
      setStage("error")
      return
    }

    if (!transactionId && !reference) {
      setMessage("Payment reference not found. Please go back and try again.")
      setStage("error")
      return
    }

    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token && !giftToken) {
        setMessage("Please sign in again to finish activating your subscription.")
        setStage("error")
        return
      }

      const headers: Record<string, string> = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
      const started  = Date.now()
      const TIMEOUT  = 150_000 // 2.5 min

      const check = async (): Promise<void> => {
        if (cancelRef.current) return
        try {
          const statusUrl = transactionId
            ? `/api/payment/status?transactionId=${encodeURIComponent(transactionId)}${giftToken ? `&gift=${encodeURIComponent(giftToken)}` : ""}`
            : `/api/payment/status?reference=${encodeURIComponent(reference)}${giftToken ? `&gift=${encodeURIComponent(giftToken)}` : ""}`

          const r      = await fetch(statusUrl, { headers, cache: "no-store" })
          const status = await r.json()
          if (cancelRef.current) return

          // Fill in any ids the status endpoint resolved for us
          if (!transactionId && status.uuid) transactionId = String(status.uuid)
          const resolvedPlan     = planParam     || String(status.plan     || "")
          const resolvedDuration = durationParam  ? Number(durationParam) : Number(status.duration ?? 30)

          const state = String(status.status || "").toLowerCase()

          if (["completed", "successful", "success", "sandbox", "paid"].includes(state)) {
            // Activate the subscription server-side
            const completeRes = await fetch("/api/payment/complete", {
              method:  "POST",
              headers: { ...headers, "Content-Type": "application/json" },
              body:    JSON.stringify({
                transactionId,
                subscriptionPlan:     resolvedPlan,
                subscriptionDuration: resolvedDuration,
                giftToken,
              }),
            })

            if (!completeRes.ok) {
              const body = await completeRes.json().catch(() => ({}))
              throw new Error(body.error || "Subscription activation failed")
            }

            const data = await completeRes.json().catch(() => ({}))
            if (cancelRef.current) return

            setPlan(data.plan   || resolvedPlan || "Premium")
            setExpiry(data.expiryDate || "")
            setStage("success")
            return
          }

          if (["failed", "cancelled", "rejected", "declined", "expired"].includes(state)) {
            throw new Error(status.error || status.provider_error || status.failure_reason || `Payment was not completed (status: ${state}). Please try again.`)
          }

          // Still pending
          if (Date.now() - started < TIMEOUT) {
            setMessage("Waiting for payment confirmation from your bank or mobile money provider…")
            setTimeout(check, 4_000)
          } else {
            if (!cancelRef.current) {
              setStage("timeout")
              setMessage("Your payment is still being processed. Your subscription will activate automatically once confirmed.")
            }
          }
        } catch (e) {
          if (!cancelRef.current) {
            setMessage(e instanceof Error ? e.message : "Unable to confirm payment.")
            setStage("error")
          }
        }
      }

      // Give the payment provider a few seconds to process before first check
      setTimeout(check, 3_000)
    })()

    return () => { cancelRef.current = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const formatExpiry = (iso: string) => {
    if (!iso) return ""
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0d1117", color: "white", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 440, background: "#161b2e", border: "1px solid rgba(255,255,255,.08)", borderRadius: 20, padding: 32, textAlign: "center" }}>

        {/* ── Checking ── */}
        {stage === "checking" && (
          <>
            <div style={{ width: 56, height: 56, borderRadius: "50%", border: "3px solid rgba(59,130,246,.15)", borderTopColor: "#3b82f6", animation: "spin 0.9s linear infinite", margin: "0 auto 24px" }} />
            <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>Confirming Payment</h1>
            <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, margin: 0 }}>{message}</p>
          </>
        )}

        {/* ── Success ── */}
        {stage === "success" && (
          <>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(74,222,128,.12)", border: "2px solid rgba(74,222,128,.4)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Payment Successful!</h1>
            {plan && (
              <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.6, marginBottom: 4 }}>
                Your <strong style={{ color: "white" }}>{plan}</strong> subscription is now active.
              </p>
            )}
            {expiry && (
              <p style={{ color: "#64748b", fontSize: 12, marginBottom: 24 }}>
                Access until {formatExpiry(expiry)}
              </p>
            )}
            {!expiry && <div style={{ marginBottom: 24 }} />}
            <button
              onClick={() => router.replace("/?page=profile")}
              style={{ width: "100%", padding: "13px 0", borderRadius: 12, background: "#3b82f6", border: 0, color: "white", fontWeight: 700, fontSize: 15, cursor: "pointer" }}
            >
              Go to My Profile
            </button>
          </>
        )}

        {/* ── Timeout ── */}
        {stage === "timeout" && (
          <>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(251,191,36,.1)", border: "2px solid rgba(251,191,36,.4)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Still Processing…</h1>
            <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>{message}</p>
            <button
              onClick={() => router.replace("/?page=profile")}
              style={{ width: "100%", padding: "13px 0", borderRadius: 12, background: "#3b82f6", border: 0, color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer", marginBottom: 10 }}
            >
              Go to My Profile
            </button>
          </>
        )}

        {/* ── Error ── */}
        {stage === "error" && (
          <>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(239,68,68,.1)", border: "2px solid rgba(239,68,68,.4)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Payment Error</h1>
            <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>{message}</p>
            <button
              onClick={() => router.replace("/?page=subscription")}
              style={{ width: "100%", padding: "13px 0", borderRadius: 12, background: "#3b82f6", border: 0, color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer", marginBottom: 10 }}
            >
              Try Again
            </button>
            <button
              onClick={() => router.replace("/?page=profile")}
              style={{ width: "100%", padding: "10px 0", borderRadius: 12, background: "transparent", border: "1px solid rgba(255,255,255,.1)", color: "#94a3b8", fontSize: 13, cursor: "pointer" }}
            >
              Go to Profile
            </button>
          </>
        )}

      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  )
}
