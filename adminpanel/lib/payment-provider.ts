const BASE_URL = (process.env.PAYMENT_API_BASE_URL || "https://wallet.wearemarz.com/api/v1").replace(/\/$/, "");

function authHeaders() {
  const credentials = process.env.PAYMENT_API_CREDENTIALS;
  if (!credentials) throw new Error("PAYMENT_API_CREDENTIALS is not configured");
  return { Authorization: `Basic ${credentials}`, Accept: "application/json" };
}

export async function paymentProviderFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers || {}) },
    cache: "no-store",
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Payment provider ${response.status}: ${body.slice(0, 500)}`);
  return body ? (JSON.parse(body) as T) : ({} as T);
}

export async function createPaymentCollection(input: {
  amount: number;
  phone_number?: string;
  country: "UG" | "KE";
  reference: string;
  description?: string;
  callback_url?: string;
  method?: "mobile_money" | "card";
  metadata?: Array<Record<string, string | number | boolean>>;
}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    form.append(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  }
  return paymentProviderFetch("/collect-money", { method: "POST", body: form });
}
