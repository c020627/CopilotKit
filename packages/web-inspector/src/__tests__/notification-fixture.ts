import { parseNotificationFeed } from "../lib/notifications.js";
/** Convert historical test copy into the current wire contract. */
export function notificationFixture(value: {
  timestamp?: string;
  previewText?: string;
  announcement?: string;
}) {
  return {
    schemaVersion: 1,
    cohorts: [
      {
        id: "all",
        name: "All",
        description: "Stable test clients",
        conditions: {},
      },
    ],
    notifications: [
      {
        id: "notice-" + Date.parse(value.timestamp ?? ""),
        title: value.previewText || "CopilotKit update",
        body: value.announcement,
        publishedAt: value.timestamp,
        cohorts: ["all"],
        priority: "Normal",
      },
    ],
  };
}
/** Per-test loader boundary. The real page-level cache has a separate test suite. */
export async function fetchNotificationFixture() {
  const response = await fetch(
    "https://cdn.copilotkit.ai/notifications/v1.json",
  );
  if (!response.ok) return null;
  const value = await response.json();
  return parseNotificationFeed(
    value.schemaVersion ? value : notificationFixture(value),
  );
}
