import path from "node:path";
import { writeFile as writeFileToDisk } from "node:fs/promises";

type SaveCsvExportInput = {
  csv: string;
  cwd?: string;
  now?: () => Date;
  writeFile?: typeof writeFileToDisk;
};

type SavedCsvExport = {
  filename: string;
  filePath: string;
  rowCount: number;
};

export async function saveCsvExport(
  input: SaveCsvExportInput,
): Promise<SavedCsvExport> {
  const cwd = input.cwd ?? process.cwd();
  const now = input.now ?? (() => new Date());
  const writeFile = input.writeFile ?? writeFileToDisk;
  const filename = createCsvExportFilename(now());
  const filePath = path.resolve(cwd, filename);

  await writeFile(filePath, input.csv, "utf8");

  return {
    filename,
    filePath,
    rowCount: countCsvRows(input.csv),
  };
}

export function createCsvExportFilename(date: Date): string {
  return `profiles-export-${formatTimestampForFilename(date)}.csv`;
}

export function countCsvRows(csv: string): number {
  const lines = csv
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== "");

  if (lines.length === 0) {
    return 0;
  }

  return Math.max(lines.length - 1, 0);
}

function formatTimestampForFilename(date: Date): string {
  const year = date.getFullYear();
  const month = padTwoDigits(date.getMonth() + 1);
  const day = padTwoDigits(date.getDate());
  const hours = padTwoDigits(date.getHours());
  const minutes = padTwoDigits(date.getMinutes());
  const seconds = padTwoDigits(date.getSeconds());

  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function padTwoDigits(value: number): string {
  return String(value).padStart(2, "0");
}
