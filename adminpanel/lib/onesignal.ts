const API_URL = "https://api.onesignal.com/notifications";

export async function sendOneSignalNotification(input: {
  title: string;
  message: string;
  url?: string;
  imageUrl?: string;
  externalIds?: string[];
}) {
  const appId  = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!appId || !apiKey) throw new Error("OneSignal credentials are not configured");

  const payload: Record<string, unknown> = {
    app_id: appId,
    headings: { en: input.title },
    contents: { en: input.message },
    target_channel: "push",
    channel_for_external_user_ids: "push",
  };

  if (input.url) payload.url = input.url;
  if (input.imageUrl) payload.big_picture = input.imageUrl;

  // Specific users must be targeted with external IDs and the push channel explicitly set.
  if (input.externalIds?.length) {
    payload.include_aliases = { external_id: input.externalIds };
  } else {
    payload.included_segments = ["Subscribed Users"];
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
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
