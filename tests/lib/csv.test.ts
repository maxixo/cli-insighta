import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";

import {
  countCsvRows,
  createCsvExportFilename,
  saveCsvExport,
} from "../../src/lib/csv.js";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("csv helpers", () => {
  it("creates a timestamped export filename", () => {
    expect(createCsvExportFilename(createLocalDate())).toBe(
      "profiles-export-20250304-050607.csv",
    );
  });

  it("counts csv rows while ignoring blank lines", () => {
    expect(countCsvRows("name,age\nAda,28\n\nGrace,35\n")).toBe(2);
    expect(countCsvRows("")).toBe(0);
  });

  it("writes the csv export to disk and returns the saved metadata", async () => {
    const cwd = await createTempDir();

    const result = await saveCsvExport({
      csv: "name,age\nAda,28\nGrace,35\n",
      cwd,
      now: createLocalDate,
    });

    expect(result).toEqual({
      filename: "profiles-export-20250304-050607.csv",
      filePath: path.join(cwd, "profiles-export-20250304-050607.csv"),
      rowCount: 2,
    });
    await expect(readFile(result.filePath, "utf8")).resolves.toBe(
      "name,age\nAda,28\nGrace,35\n",
    );
  });
});

async function createTempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "insighta-csv-"));
  tempDirectories.push(directory);
  return directory;
}

function createLocalDate(): Date {
  return new Date(2025, 2, 4, 5, 6, 7);
}
