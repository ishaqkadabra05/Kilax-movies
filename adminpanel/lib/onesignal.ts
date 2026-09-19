const API_URL = "https://api.onesignal.com/notifications";

export async function sendOneSignalNotification(input: {
  title: string;
  message: string;
  url?: string;
  externalIds?: string[];
}) {
  const appId  = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!appId || !apiKey) throw new Error("OneSignal credentials are not configured");

  const payload: Record<string, unknown> = {
    app_id:         appId,
    headings:       { en: input.title },
    contents:       { en: input.message },
    target_channel: "push",   // required for web push
  };

  if (input.url) payload.url = input.url;

  // Target specific users by their Supabase UUID (set as OneSignal external_id)
  // or broadcast to all subscribers when no IDs are provided.
  if (input.externalIds?.length) {
    payload.include_aliases = { external_id: input.externalIds };
  } else {
    // "Subscribed Users" is the OneSignal default segment — always exists
    payload.included_segments = ["Subscribed Users"];
  }

  const response = await fetch(API_URL, {
    method:  "POST",
    headers: {
      Authorization:  `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`OneSignal ${response.status}: ${body.slice(0, 500)}`);
  }
  return body ? JSON.parse(body) : {};
}
