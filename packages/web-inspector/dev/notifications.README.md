# Local notification authoring

Run `pnpm nx run @copilotkit/web-inspector:dev:standalone`, then open
[Notifications](http://127.0.0.1:5177/notifications.html) from the workbench navigation.
These authoring controls are development tools, outside the published Inspector.

1. Choose an example or write a title and Markdown body. Name the cohort and set
   its conditions. Blank audience fields mean unrestricted; all filled fields must match.
2. Enter a simulated client SDK version, framework, and Intelligence state. Open
   the additional fields for runtime version, deployment, and license. Blank client
   metadata means unknown, so it cannot satisfy a condition that requires a value.
3. Click **Preview notification**, then hover the real Inspector logo or select
   **What's New**. Client changes refresh the preview automatically. **Replay**
   clears only the isolated preview's read/dismissal state.
4. Click **Copy authoring prompt** and paste into an agent working in the
   Intelligence repository. The prompt invokes `author-notification`, preserves
   the title, body, conditions and priority, and requests validation and a draft PR.
   The agent chooses production IDs and reuses or creates the cohort.

The SDK's npm-semver matcher drives both the result and the actual Inspector.
Prerelease installations never match. The client fields simulate metadata directly;
use the **Scenarios** workbench to test real Core/runtime metadata propagation.
The fixed preview date and IDs are placeholders, not publishing metadata.

The current draft is saved locally in the browser. Invalid drafts cannot be exported.
The preview uses in-memory cookies and storage, so it cannot dismiss notifications
in the parent workbench. The editor does not call an LLM, create a PR, contact AWS,
or publish anything itself. Git remains the source of published notifications.

Checks:

```sh
pnpm nx run @copilotkit/web-inspector:test -- dev/notification-authoring.spec.ts
pnpm nx run @copilotkit/web-inspector:test:browser -- --grep 'drafts a cohort|preview dismissal'
pnpm nx run @copilotkit/web-inspector:check-types
```
