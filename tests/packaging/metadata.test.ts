import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("package metadata", () => {
  it("keeps the package installable as the insighta CLI", async () => {
    const packageJson = JSON.parse(
      await readFile(new URL("../../package.json", import.meta.url), "utf8"),
    ) as {
      bin?: Record<string, string>;
      files?: string[];
      scripts?: Record<string, string>;
    };

    expect(packageJson.bin?.insighta).toBe("./dist/bin/insighta.js");
    expect(packageJson.files).toContain("dist");
    expect(packageJson.scripts?.prepack).toBe("npm run clean && npm run build");
    expect(packageJson.scripts?.["smoke:install"]).toBe(
      "node ./scripts/smoke-install.mjs",
    );
  });
});
