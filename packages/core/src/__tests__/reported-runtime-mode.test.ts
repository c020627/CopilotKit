import { expect, test, vi } from "vitest";
import { CopilotKitCore, CopilotKitCoreRuntimeConnectionStatus } from "../core";

test.each([undefined, "sse", "intelligence"])(
  "retains the explicitly reported mode %s without confusing defaults",
  async (mode) => {
    vi.stubGlobal("window", {});
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              version: "1.70.2",
              agents: {},
              ...(mode ? { mode } : {}),
            }),
            { headers: { "content-type": "application/json" } },
          ),
      ),
    );
    try {
      const core = new CopilotKitCore({
        runtimeUrl: "https://notification-runtime.test",
        runtimeTransport: "rest",
      });
      await vi.waitFor(() =>
        expect(core.runtimeConnectionStatus).toBe(
          CopilotKitCoreRuntimeConnectionStatus.Connected,
        ),
      );
      expect(core.ɵreportedRuntimeMode).toBe(mode);
      expect(core.runtimeMode).toBe(mode ?? "sse");
    } finally {
      vi.unstubAllGlobals();
    }
  },
);
