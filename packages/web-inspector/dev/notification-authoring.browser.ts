import { expect, test } from "@playwright/test";

test("drafts a cohort, excludes unknown clients, and exports the exact authoring prompt", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/notifications.html");
  await expect(page.locator("#preview-status")).toHaveText(
    "Live Inspector · local fixture",
  );
  await page.locator('[name="title"]').fill("Fix for Pro teams");
  await page
    .locator('[name="body"]')
    .fill("## Upgrade\n\nRun `npm update` and read the **release notes**.");
  await page.locator('[name="intelligence"]').selectOption("enabled");
  await page.locator('[name="plan"]').fill("pro");
  await page.locator('[name="clientIntelligence"]').selectOption("enabled");
  await page.locator('[name="clientPlan"]').fill("pro");
  await page.locator("#preview-view").selectOption("updates");
  const preview = page.frameLocator("#preview-frame");
  await preview.locator(".cpk-notification-row").click();
  await expect(
    preview.locator(".inspector-whats-new-document-header h1"),
  ).toHaveText("Fix for Pro teams");
  await expect(preview.locator(".announcement-content strong")).toHaveText(
    "release notes",
  );
  await expect(
    preview.getByText("CopilotKit core not attached", { exact: true }),
  ).toHaveCount(0);
  await page.locator("#copy-prompt").click();
  const prompt = await page.evaluate(() => navigator.clipboard.readText());
  expect(prompt).toContain('"plan": "pro"');
  expect(prompt).toContain("Title (preserve exactly): Fix for Pro teams");
  expect(prompt).toContain(
    "## Upgrade\n\nRun `npm update` and read the **release notes**.",
  );
  expect(prompt).toContain("author-notification");
  await page.locator('[name="clientIntelligence"]').selectOption("");
  await expect(page.locator("#match-result")).toContainText(
    "intelligence is unknown",
  );
  await expect(
    preview.getByText("You're all caught up.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator('[name="title"]')).toHaveValue("Fix for Pro teams");
  await page.locator('[name="sdkVersion"]').fill("previous release");
  await expect(page.locator("#draft-error")).toContainText(
    "Invalid sdkVersion",
  );
  await expect(page.locator("#copy-prompt")).toBeDisabled();
  await expect(page.locator("#preview-frame")).toHaveAttribute(
    "src",
    "about:blank",
  );
});

test("preview dismissal is isolated and Replay re-arms the real bubble", async ({
  page,
}) => {
  await page.goto("/notifications.html");
  await page.evaluate(() => {
    localStorage.setItem("cpk:inspector:notifications:v1", "parent-state");
    document.cookie = "cpk_inspector_notifications_v1=parent-cookie; Path=/";
  });
  await page.locator("#replay").click();
  const preview = page.frameLocator("#preview-frame");
  await preview.locator(".console-button").hover();
  await preview
    .getByRole("button", { name: "Dismiss notification", exact: true })
    .click();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("cpk:inspector:notifications:v1"),
    ),
  ).toBe("parent-state");
  expect(await page.evaluate(() => document.cookie)).toContain(
    "cpk_inspector_notifications_v1=parent-cookie",
  );
  await page.locator("#replay").click();
  await preview.locator(".console-button").hover();
  await expect(
    preview.getByRole("button", {
      name: "Open new notification: Update CopilotKit",
      exact: true,
    }),
  ).toBeVisible();
});
