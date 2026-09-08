import { expect, test } from "vitest";
import {
  matchNotification,
  parseNotificationFeed,
  emptyNotificationState,
  reconcileNotifications,
  acknowledgeNotification,
} from "../notifications.js";
import type {
  NotificationFeed,
  NotificationContext,
  CohortNotification,
} from "../notifications.js";

const feed: NotificationFeed = {
  schemaVersion: 1,
  cohorts: [
    {
      id: "react-fix",
      name: "React fix",
      description: "Affected stable releases",
      conditions: { framework: "react", sdkVersion: ">=1.70.1 <1.71.0" },
    },
  ],
  notifications: [
    {
      id: "upgrade",
      title: "Upgrade",
      body: "Install the fix.",
      publishedAt: "2026-09-08T12:00:00.000Z",
      cohorts: ["react-fix"],
      priority: "High",
    },
  ],
};

test("matches a stable SDK inside an npm comparator set", () => {
  const result = matchNotification(feed.notifications[0]!, feed, {
    development: true,
    framework: "react",
    sdkVersion: "1.70.2",
  });

  expect(result).toEqual({
    matches: true,
    cohorts: ["react-fix"],
    reasons: [],
  });
});

const context: NotificationContext = {
  development: true,
  framework: "react",
  sdkVersion: "1.70.2",
};

test.each([
  "1.70.2",
  "^1.70.0",
  "~1.70.1",
  "1.70.x",
  "1.70.0 - 1.70.3",
  "<1.0.0 || >=1.70.0",
])("accepts npm range %s", (range) => {
  const scoped = {
    ...feed,
    cohorts: [{ ...feed.cohorts[0]!, conditions: { sdkVersion: range } }],
  };

  expect(
    matchNotification(scoped.notifications[0]!, scoped, context).matches,
  ).toBe(true);
});

test.each([
  { ...context, development: false },
  { ...context, framework: "vue" as const },
  { ...context, sdkVersion: "1.70.0" },
  { ...context, sdkVersion: "1.71.0" },
  { ...context, sdkVersion: "1.70.2-beta.1" },
  { ...context, sdkVersion: undefined },
])("excludes nonmatching or unsupported installations: %j", (installation) => {
  expect(
    matchNotification(feed.notifications[0]!, feed, installation).matches,
  ).toBe(false);
});

test("an unrestricted cohort still excludes prerelease and unknown SDKs", () => {
  const scoped = {
    ...feed,
    cohorts: [{ ...feed.cohorts[0]!, conditions: {} }],
  };

  expect(
    matchNotification(feed.notifications[0]!, scoped, { development: true })
      .matches,
  ).toBe(false);
  expect(
    matchNotification(feed.notifications[0]!, scoped, {
      ...context,
      sdkVersion: "1.71.0-beta.1",
    }).matches,
  ).toBe(false);
});

test("unknown Intelligence never matches disabled and a confirmed state does", () => {
  const scoped = {
    ...feed,
    cohorts: [
      {
        ...feed.cohorts[0]!,
        conditions: { intelligence: "disabled" as const },
      },
    ],
  };

  expect(
    matchNotification(feed.notifications[0]!, scoped, context).matches,
  ).toBe(false);
  expect(
    matchNotification(feed.notifications[0]!, scoped, {
      ...context,
      intelligence: "disabled",
    }).matches,
  ).toBe(true);
});

test("unknown plan, deployment, license and runtime fail their required conditions", () => {
  const scoped: NotificationFeed = {
    ...feed,
    cohorts: [
      {
        ...feed.cohorts[0]!,
        conditions: {
          plan: "pro",
          deployment: "managed",
          license: "valid",
          runtimeVersion: "^1.70.0",
        },
      },
    ],
  };

  expect(
    matchNotification(feed.notifications[0]!, scoped, context).matches,
  ).toBe(false);
  expect(
    matchNotification(feed.notifications[0]!, scoped, {
      ...context,
      plan: "pro",
      deployment: "managed",
      license: "valid",
      runtimeVersion: "1.70.1",
    }).matches,
  ).toBe(true);
});

test("validates the feed and fails closed on unknown schemas and bad references", () => {
  expect(parseNotificationFeed(feed)).toEqual(feed);
  expect(parseNotificationFeed({ ...feed, schemaVersion: 2 })).toBeNull();
  expect(parseNotificationFeed({ ...feed, cohorts: [] })).toBeNull();
  expect(
    parseNotificationFeed({
      ...feed,
      notifications: [...feed.notifications, ...feed.notifications],
    }),
  ).toBeNull();
  expect(
    parseNotificationFeed({
      ...feed,
      cohorts: [{ ...feed.cohorts[0], conditions: { sdkVersion: "latest" } }],
    }),
  ).toBeNull();
});

function notice(
  id: string,
  priority: CohortNotification["priority"] = "Normal",
): CohortNotification {
  return { ...feed.notifications[0]!, id, priority };
}

test("reading the highlighted notice suppresses backlog but a new Low notice can appear", () => {
  const catalog = {
    ...feed,
    notifications: [notice("high", "High"), notice("old-low", "Low")],
  };
  const selected = reconcileNotifications(
    emptyNotificationState(),
    catalog,
    context,
  );

  expect(selected.activeId).toBe("high");
  const read = acknowledgeNotification(selected, "high");
  expect(read.readIds).toEqual(["high"]);
  expect(read.suppressedIds).toEqual(["high", "old-low"]);
  expect(reconcileNotifications(read, catalog, context).activeId).toBeNull();
  expect(
    reconcileNotifications(
      read,
      {
        ...catalog,
        notifications: [...catalog.notifications, notice("new-low", "Low")],
      },
      context,
    ).activeId,
  ).toBe("new-low");
});

test("equal arrivals keep the current bubble; a higher priority replaces it", () => {
  const catalog = { ...feed, notifications: [notice("current")] };
  const selected = reconcileNotifications(
    emptyNotificationState(),
    catalog,
    context,
  );

  expect(
    reconcileNotifications(
      selected,
      {
        ...catalog,
        notifications: [...catalog.notifications, notice("equal")],
      },
      context,
    ).activeId,
  ).toBe("current");
  expect(
    reconcileNotifications(
      selected,
      {
        ...catalog,
        notifications: [...catalog.notifications, notice("urgent", "Urgent")],
      },
      context,
    ).activeId,
  ).toBe("urgent");
});

test("same ID edits remain silent and suppressed IDs do not rearm after eligibility toggles", () => {
  const selected = reconcileNotifications(
    emptyNotificationState(),
    feed,
    context,
  );
  const read = acknowledgeNotification(selected, "upgrade");
  const away = reconcileNotifications(read, feed, {
    ...context,
    sdkVersion: "1.0.0",
  });
  const edited = {
    ...feed,
    notifications: [
      {
        ...feed.notifications[0]!,
        title: "Edited",
        priority: "Urgent" as const,
      },
    ],
  };

  expect(reconcileNotifications(away, edited, context).activeId).toBeNull();
});

test("newly applicable notices surface and withdrawal does not promote backlog", () => {
  const catalog = {
    ...feed,
    notifications: [notice("high", "High"), notice("low", "Low")],
  };
  const away = reconcileNotifications(emptyNotificationState(), catalog, {
    ...context,
    sdkVersion: "1.0.0",
  });
  const selected = reconcileNotifications(away, catalog, context);

  expect(selected.activeId).toBe("high");
  expect(
    reconcileNotifications(
      selected,
      { ...catalog, notifications: [notice("low", "Low")] },
      context,
    ).activeId,
  ).toBeNull();
});

test("reading another notice leaves the highlight and unrelated unread notices alone", () => {
  const selected = reconcileNotifications(
    emptyNotificationState(),
    { ...feed, notifications: [notice("high", "High"), notice("low", "Low")] },
    context,
  );
  const read = acknowledgeNotification(selected, "low");

  expect(read.activeId).toBe("high");
  expect(read.suppressedIds).toEqual(["low"]);
});
