import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { expect, test } from "vitest";

const source = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("the Intelligence landing and both sidebars link to the SDK and Runtime guide", () => {
  const overview = readFileSync(
    resolve(source, "content/snippets/shared/intelligence/overview.mdx"),
    "utf8",
  );
  const section = JSON.parse(
    readFileSync(
      resolve(source, "content/docs/intelligence/meta.json"),
      "utf8",
    ),
  );
  const root = JSON.parse(
    readFileSync(resolve(source, "content/docs/meta.json"), "utf8"),
  );

  expect(overview).toContain(
    "[SDKs and Runtimes](/intelligence/sdks-and-runtimes)",
  );
  expect(section.pages).toContain("sdks-and-runtimes");
  expect(root.pages).toContain("intelligence/sdks-and-runtimes");
});

test("the guide covers all five languages and the standalone SDK boundary", () => {
  const page = matter(
    readFileSync(
      resolve(source, "content/docs/intelligence/sdks-and-runtimes.mdx"),
      "utf8",
    ),
  );

  expect(page.data.title).toBe("SDKs and Runtimes");
  expect(page.data.frontend).toBe("universal");
  for (const language of ["TypeScript", "Python", "Go", "Ruby", "C#"]) {
    expect(page.content).toContain(`### ${language}`);
  }
  expect(page.content).toContain("## Use the SDK without a Runtime");
  expect(page.content).toContain("## Connect your frontend through a Runtime");
  expect(page.content).toContain("## Assign threads to a Learning Container");
  expect(page.content).toContain("existing Learning Container");
  expect(page.content).toContain("Intelligence Runner");
  expect(page.content).toContain("Memory");
  expect(page.content).not.toContain("NEXT_PUBLIC_CPK_INTELLIGENCE_API_KEY");
});
