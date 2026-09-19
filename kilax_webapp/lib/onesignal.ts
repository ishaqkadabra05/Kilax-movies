const oneSignalApiUrl = "https://api.onesignal.com/notifications";

type OneSignalMessage = {
  title: string;
  body: string;
  url?: string | null;
  data?: Record<string, unknown>;
};

export async function sendOneSignalNotification(
  message: OneSignalMessage,
  userIds?: string[],
) {
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!appId || !apiKey) throw new Error("OneSignal server configuration is missing");

  const payload: Record<string, unknown> = {
    app_id: appId,
    headings: { en: message.title },
    contents: { en: message.body },
    target_channel: "push",
    data: message.data || {},
  };

  if (message.url) payload.url = message.url;
  if (userIds?.length) {
    payload.include_aliases = { external_id: userIds };
  } else {
    payload.included_segments = ["Subscribed Users"];
  }

  const response = await fetch(oneSignalApiUrl, {
    method: "POST",
    headers: { Authorization: `Key ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.errors?.join?.(", ") || result?.message || "OneSignal delivery failed");
  }
  return result;
}