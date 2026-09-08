import { parseNotificationFeed } from "./notifications.js";
import type { NotificationFeed } from "./notifications.js";

export const NOTIFICATION_FEED_URL =
  "https://cdn.copilotkit.ai/notifications/v1.json";
let request: Promise<NotificationFeed | null> | undefined;
/** Share one request per page; failures stay quiet until the next page load. */
export function loadNotificationFeed(): Promise<NotificationFeed | null> {
  if (typeof window === "undefined" || typeof fetch === "undefined")
    return Promise.resolve(null);
  request ??= fetch(NOTIFICATION_FEED_URL, {
    cache: "no-cache",
    credentials: "omit",
  })
    .then(async (response) =>
      response.ok ? parseNotificationFeed(await response.json()) : null,
    )
    .catch(() => null);
  return request;
}
