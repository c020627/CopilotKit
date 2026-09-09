import {
  compilePreview,
  DEFAULT_FIELDS,
  PRESETS,
  presetFields,
} from "./notification-authoring.js";
import type { AuthoringFields } from "./notification-authoring.js";
const draftForm = document.querySelector<HTMLFormElement>("#draft-form")!;
const clientForm = document.querySelector<HTMLFormElement>("#client-form")!;
const frame = document.querySelector<HTMLIFrameElement>("#preview-frame")!;
const error = document.querySelector<HTMLElement>("#draft-error")!;
const result = document.querySelector<HTMLElement>("#match-result")!;
const prompt = document.querySelector<HTMLTextAreaElement>("#prompt")!;
const copy = document.querySelector<HTMLButtonElement>("#copy-prompt")!;
const status = document.querySelector<HTMLElement>("#save-status")!;
const previewStatus = document.querySelector<HTMLElement>("#preview-status")!;
const view = document.querySelector<HTMLSelectElement>("#preview-view")!;
const preset = document.querySelector<HTMLSelectElement>("#preset")!;
const STORAGE_KEY = "cpk:workbench:notification-draft:v1";
let current: ReturnType<typeof compilePreview> | undefined;
let revision = 0;
function fields(): AuthoringFields {
  return Object.fromEntries(
    [...new FormData(draftForm), ...new FormData(clientForm)].map(
      ([key, value]) => [key, String(value)],
    ),
  );
}
function fill(values: AuthoringFields) {
  for (const form of [draftForm, clientForm])
    for (const input of form.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("[name]"))
      input.value = values[input.name] ?? "";
}
function validate() {
  try {
    current = compilePreview(fields());
    error.hidden = true;
    copy.disabled = false;
    prompt.value = current.prompt;
    result.replaceChildren();
    result.dataset.matches = String(current.result.matches);
    const heading = document.createElement("strong");
    heading.textContent = current.result.matches
      ? "Matches this client"
      : "Does not match this client";
    result.append(heading);
    if (current.result.matches)
      result.append("This notice is eligible for the bubble and What's New.");
    else {
      const reasons = document.createElement("ul");
      for (const reason of current.result.reasons) {
        const li = document.createElement("li");
        li.textContent = reason
          .replace("preview-cohort: ", "")
          .replace("sdkVersion", "SDK version")
          .replace("runtimeVersion", "Runtime version");
        reasons.append(li);
      }
      result.append(reasons);
    }
  } catch (e) {
    current = undefined;
    error.hidden = false;
    error.textContent = e instanceof Error ? e.message : "Invalid draft";
    copy.disabled = true;
    prompt.value = "";
    result.textContent = "Fix the draft to test this audience.";
    result.dataset.matches = "false";
    frame.src = "about:blank";
    previewStatus.textContent = "Preview unavailable · fix the draft";
  }
}
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fields()));
    status.textContent = "Draft saved in this browser.";
  } catch {
    status.textContent =
      "Browser storage unavailable. Copy your prompt to keep it.";
  }
}
function preview() {
  validate();
  if (!current) return;
  save();
  previewStatus.textContent = "Loading preview…";
  frame.src = `/notification-preview.html?revision=${++revision}`;
}
function changed() {
  preset.value = "";
  validate();
  save();
  previewStatus.textContent = "Draft changed · click Preview to apply";
}
for (const [key, value] of Object.entries(PRESETS))
  preset.add(new Option(value.label, key));
let restored: AuthoringFields = { ...DEFAULT_FIELDS };
try {
  const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
  if (
    raw &&
    typeof raw === "object" &&
    !Array.isArray(raw) &&
    Object.values(raw).every((v) => typeof v === "string")
  )
    restored = { ...restored, ...raw };
} catch {
  status.textContent = "Could not restore the previous draft.";
}
fill(restored);
validate();
draftForm.addEventListener("input", changed);
clientForm.addEventListener("input", () => {
  validate();
  save();
  if (current) preview();
});
clientForm.addEventListener("submit", (e) => {
  e.preventDefault();
  preview();
});
draftForm.addEventListener("submit", (e) => {
  e.preventDefault();
  preview();
});
preset.addEventListener("change", () => {
  if (preset.value) {
    fill(presetFields(preset.value));
    preview();
  }
});
view.addEventListener("change", preview);
document.querySelector("#replay")!.addEventListener("click", preview);
copy.addEventListener("click", async () => {
  validate();
  if (!current) return;
  try {
    await navigator.clipboard.writeText(current.prompt);
    status.textContent =
      "Prompt copied. Paste it into your agent in Intelligence.";
  } catch {
    prompt.closest("details")!.open = true;
    prompt.select();
    status.textContent = "Copy the selected prompt manually.";
  }
});
window.addEventListener("message", (event) => {
  if (event.origin !== location.origin || event.source !== frame.contentWindow)
    return;
  if (event.data?.kind === "notification-preview-ready" && current)
    frame.contentWindow?.postMessage(
      {
        kind: "notification-preview",
        feed: current.feed,
        context: current.context,
        view: view.value,
      },
      location.origin,
    );
  if (event.data?.kind === "notification-preview-mounted")
    previewStatus.textContent = "Live Inspector · local fixture";
});

preview();
