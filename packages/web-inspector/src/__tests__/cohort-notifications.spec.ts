import {
  CopilotKitCore,
  CopilotKitCoreRuntimeConnectionStatus,
} from "@copilotkit/core";
import type { RuntimeMode } from "@copilotkit/shared";
import type { NotificationFeed } from "../lib/notifications.js";
import { afterEach, expect, test, vi } from "vitest";
import { WebInspectorElement, configureWebInspectorElement } from "../index.js";
import { loadNotificationState } from "../lib/persistence.js";

const feed: NotificationFeed = {
  schemaVersion: 1,
  cohorts: [
    { id: "all", name: "All", description: "Stable clients", conditions: {} },
  ],
  notifications: [
    {
      id: "high",
      title: "Update CopilotKit",
      body: "A **fix** with [details](https://example.com).",
      publishedAt: "2026-09-08T12:00:00.000Z",
      cohorts: ["all"],
      priority: "High",
    },
    {
      id: "low",
      title: "Another update",
      body: "More news.",
      publishedAt: "2026-09-01T12:00:00.000Z",
      cohorts: ["all"],
      priority: "Low",
    },
  ],
};
// The loader owns one request per page. A test replaces that page-level boundary,
// leaving feed validation and request caching covered by loader tests.
vi.mock("../lib/notification-loader.js", () => ({
  loadNotificationFeed: vi.fn(async () => feed),
}));
import { loadNotificationFeed } from "../lib/notification-loader.js";

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  document.cookie = "cpk_inspector_notifications_v1=; Path=/; Max-Age=0";
  vi.clearAllMocks();
});

async function mount(development = true, core: CopilotKitCore | null = null) {
  const inspector = configureWebInspectorElement(
    new WebInspectorElement(),
    core,
    { development, framework: "react", sdkVersion: "1.70.2" },
  );
  document.body.append(inspector);
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
    await inspector.updateComplete;
  }
  return inspector;
}

function button(
  inspector: WebInspectorElement,
  label: string,
): HTMLButtonElement {
  const element = [
    ...(inspector.shadowRoot?.querySelectorAll("button") ?? []),
  ].find(
    (b) =>
      b.getAttribute("aria-label") === label || b.textContent?.trim() === label,
  );
  if (!element) throw new Error(`Missing button: ${label}`);
  return element;
}

test("production and unconfigured Inspectors never request notifications", async () => {
  await mount(false);
  const unconfigured = new WebInspectorElement();
  document.body.append(unconfigured);
  await unconfigured.updateComplete;
  expect(loadNotificationFeed).not.toHaveBeenCalled();
});

test("shows one badge-free preview and X suppresses backlog across remounts", async () => {
  const inspector = await mount();
  expect(
    inspector.shadowRoot?.querySelector(".cpk-notification-preview")
      ?.textContent,
  ).toContain("Update CopilotKit");
  expect(
    inspector.shadowRoot?.querySelector(".cpk-notification-preview")
      ?.textContent,
  ).not.toMatch(/High|Urgent|Normal|Low/);
  button(inspector, "Dismiss notification").click();
  await inspector.updateComplete;
  expect(loadNotificationState().suppressedIds).toEqual(["high", "low"]);
  inspector.remove();
  const next = await mount();
  expect(
    next.shadowRoot?.querySelector(".cpk-notification-preview"),
  ).toBeNull();
});

test("reading the preview opens its Markdown and leaves both notices browseable", async () => {
  const inspector = await mount();
  button(inspector, "Update CopilotKit").click();
  await inspector.updateComplete;
  expect(
    inspector.shadowRoot?.querySelector(".announcement-content strong")
      ?.textContent,
  ).toBe("fix");
  expect(loadNotificationState().readIds).toEqual(["high"]);
  button(inspector, "← All updates").click();
  await inspector.updateComplete;
  expect(
    inspector.shadowRoot?.querySelectorAll(".cpk-notification-row"),
  ).toHaveLength(2);
});

test("reading another notice does not dismiss the highlighted notice", async () => {
  const inspector = await mount();
  inspector.openInspector("floating_button");
  await inspector.updateComplete;
  inspector.shadowRoot
    ?.querySelector<HTMLButtonElement>('[data-inspector-menu-key="whats-new"]')
    ?.click();
  await inspector.updateComplete;
  const row = [
    ...(inspector.shadowRoot?.querySelectorAll<HTMLButtonElement>(
      ".cpk-notification-row",
    ) ?? []),
  ].find((b) => b.textContent?.includes("Another update"));
  expect(row).toBeDefined();
  row?.click();
  await inspector.updateComplete;
  expect(loadNotificationState().activeId).toBe("high");
  expect(loadNotificationState().readIds).toEqual(["low"]);
});

class NotificationCore extends CopilotKitCore {
  mode?: RuntimeMode;
  override get ɵreportedRuntimeMode() {
    return this.mode;
  }
  async confirm(mode: RuntimeMode) {
    this.mode = mode;
    await this.notifySubscribers(
      (subscriber) =>
        subscriber.onRuntimeConnectionStatusChanged?.({
          copilotkit: this,
          status: CopilotKitCoreRuntimeConnectionStatus.Connected,
        }),
      "notification test",
    );
  }
}

test("runtime targeting remains quiet until confirmed metadata arrives", async () => {
  const targeted: NotificationFeed = {
    ...feed,
    cohorts: [{ ...feed.cohorts[0]!, conditions: { intelligence: "enabled" } }],
  };
  vi.mocked(loadNotificationFeed).mockResolvedValueOnce(targeted);
  const core = new NotificationCore({ deferInitialConnection: true });
  const inspector = await mount(true, core);
  expect(
    inspector.shadowRoot?.querySelector(".cpk-notification-preview"),
  ).toBeNull();
  await core.confirm("sse");
  await inspector.updateComplete;
  expect(
    inspector.shadowRoot?.querySelector(".cpk-notification-preview"),
  ).toBeNull();
  await core.confirm("intelligence");
  await inspector.updateComplete;
  expect(
    inspector.shadowRoot?.querySelector(".cpk-notification-preview"),
  ).not.toBeNull();
  expect(loadNotificationFeed).toHaveBeenCalledTimes(1);
});
