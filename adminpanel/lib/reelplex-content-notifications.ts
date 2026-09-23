import { createUserDb } from "@/lib/supabase/user-db";
import { reelplexiFetch } from "@/lib/reelplexi";
import { sendOneSignalNotification } from "@/lib/onesignal";

export type ReelplexContentType = "movie" | "series";

interface ReelplexContentItem {
  id: string;
  title: string;
  vj: string;
  type: ReelplexContentType;
}

interface ReelplexApiItem {
  id?: string | number;
  title?: string;
  vj?: string;
  creator?: string;
  channel?: string;
  type?: string;
}

function normalizeItem(item: ReelplexApiItem | null | undefined, type: ReelplexContentType): ReelplexContentItem | null {
  const title = String(item?.title ?? "").trim();
  if (!title) return null;

  const id = String(item?.id ?? `${type}:${title}`);
  const vj = String(item?.vj || item?.creator || item?.channel || "Unknown VJ").trim() || "Unknown VJ";

  return { id, title, vj, type };
}

async function getLatestContent(type: ReelplexContentType) {
  const endpoint = type === "movie" ? "/v1/movies?per_page=10" : "/v1/series?per_page=10";
  const payload = await reelplexiFetch<any>(endpoint, { cacheTtl: 60 });
  const items = Array.isArray(payload?.data)
    ? payload.data as ReelplexApiItem[]
    : Array.isArray(payload?.items)
      ? payload.items as ReelplexApiItem[]
      : [];

  return items
    .map((item: ReelplexApiItem) => normalizeItem(item, type))
    .filter((item: ReelplexContentItem | null): item is ReelplexContentItem => Boolean(item));
}

function getContentLabel(type: ReelplexContentType) {
  return type === "movie" ? "Movie" : "Series";
}

export async function syncNewReelplexContentNotifications() {
  const db = createUserDb();
  const results = await Promise.all([
    getLatestContent("movie"),
    getLatestContent("series"),
  ]);

  let totalNotifications = 0;

  for (const [index, items] of results.entries()) {
    const type: ReelplexContentType = index === 0 ? "movie" : "series";
    const { data: lastState } = await db
      .from("reelplex_notification_state")
      .select("last_content_id")
      .eq("content_type", type)
      .maybeSingle();

    const lastContentId = lastState?.last_content_id ? String(lastState.last_content_id) : "";
    const newContent = (() => {
      if (!lastContentId) return items.slice(0, 5);

      const knownIndex = items.findIndex((item) => item.id === lastContentId);
      if (knownIndex === -1) return items.slice(0, Math.min(items.length, 5));
      if (knownIndex === 0) return [];

      return items.slice(0, knownIndex);
    })();

    const uniqueContent = newContent.filter((item: ReelplexContentItem, index: number, arr: ReelplexContentItem[]) =>
      arr.findIndex((entry: ReelplexContentItem) => entry.id === item.id) === index
    );

    for (const item of uniqueContent) {
      const title = `New ${getContentLabel(type)} Added`;
      const message = `${item.title} by ${item.vj} has just been added to Kilax Movies Platform.`;

      try {
        await sendOneSignalNotification({
          title,
          message,
        });
        totalNotifications += 1;
      } catch (error) {
        console.error(`[reelplex] Failed to send ${type} notification for ${item.title}:`, error);
      }
    }

    const latest = items[0];
    if (latest) {
      const { error } = await db
        .from("reelplex_notification_state")
        .upsert(
          {
            content_type: type,
            last_content_id: latest.id,
            last_content_title: latest.title,
            last_vj: latest.vj,
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "content_type" }
        );

      if (error) {
        console.error(`[reelplex] Failed to persist ${type} notification state:`, error.message);
      }
    }
  }

  return {
    movies: results[0]?.length ?? 0,
    series: results[1]?.length ?? 0,
    notificationsSent: totalNotifications,
  };
}
