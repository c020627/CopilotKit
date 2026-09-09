import { expect, test } from "vitest";
import {
  compilePreview,
  DEFAULT_FIELDS,
  PRESETS,
  presetFields,
} from "./notification-authoring.js";

test("every preset produces a matching example with the SDK matcher", () => {
  for (const key of Object.keys(PRESETS))
    expect(compilePreview(presetFields(key)).result.matches, key).toBe(true);
});
test("uses stable semver boundaries and fails closed for unknown Intelligence", () => {
  for (const [version, matches] of [
    ["1.70.0", false],
    ["1.70.1", true],
    ["1.70.9", true],
    ["1.71.0", false],
    ["1.70.2-beta.1", false],
  ] as const)
    expect(
      compilePreview({ ...DEFAULT_FIELDS, clientSdkVersion: version }).result
        .matches,
    ).toBe(matches);
  for (const intelligence of ["enabled", ""])
    expect(
      compilePreview({ ...DEFAULT_FIELDS, clientIntelligence: intelligence })
        .result.matches,
    ).toBe(false);
});
test("requires all framework, runtime, plan, deployment and license conditions", () => {
  const fields = {
    ...presetFields("pro"),
    framework: "angular",
    runtimeVersion: "^1.70.0",
    deployment: "managed",
    license: "valid",
    clientFramework: "angular",
    clientRuntimeVersion: "1.70.2",
    clientDeployment: "managed",
    clientLicense: "valid",
  };
  expect(compilePreview(fields).result.matches).toBe(true);
  for (const field of [
    "clientPlan",
    "clientRuntimeVersion",
    "clientDeployment",
    "clientLicense",
  ])
    expect(
      compilePreview({ ...fields, [field]: "" }).result.matches,
      field,
    ).toBe(false);
  expect(
    compilePreview({ ...fields, clientFramework: "vue" }).result.matches,
  ).toBe(false);
});
test("rejects invalid ranges and overrides before preview or export", () => {
  expect(() =>
    compilePreview({ ...DEFAULT_FIELDS, sdkVersion: "previous" }),
  ).toThrow("Invalid sdkVersion");
  for (const priorityOverride of ["-1", "1.5", "urgent", "9007199254740992"])
    expect(() =>
      compilePreview({ ...DEFAULT_FIELDS, priorityOverride }),
    ).toThrow("Priority override");
  expect(() => compilePreview({ ...DEFAULT_FIELDS, title: "" })).toThrow(
    "title",
  );
  expect(() =>
    compilePreview({ ...DEFAULT_FIELDS, clientSdkVersion: "^1.70.2" }),
  ).toThrow("exact client SDK");
});
test("handoff preserves Markdown, explicit title, exact audience and zero override", () => {
  const body =
    "## Details\n\n**Fix** this with `npm update`.\n\n[Notes](https://example.com)";
  const { feed, prompt } = compilePreview({
    ...DEFAULT_FIELDS,
    title: "PM's explicit title",
    body,
    priority: "Urgent",
    priorityOverride: "0",
  });
  expect(feed.notifications[0]?.body).toBe(body);
  expect(feed.notifications[0]?.priorityOverride).toBe(0);
  expect(prompt).toContain("Title (preserve exactly): PM's explicit title");
  expect(prompt).toContain(body);
  expect(prompt).toContain('"sdkVersion": ">=1.70.1 <1.71.0"');
  expect(prompt).toContain('"intelligence": "disabled"');
  expect(prompt).toContain("numeric override: 0");
  expect(prompt).toContain("author-notification");
  expect(prompt).toContain(
    "Do not merge, publish, release, or perform AWS actions.",
  );
});
