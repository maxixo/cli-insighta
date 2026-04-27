import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";

import {
  CredentialsStoreError,
  credentialsExist,
  deleteCredentials,
  readCredentials,
  resolveCredentialsPaths,
  writeCredentials,
} from "../../src/lib/credentials-store.js";
import { createStoredCredentials } from "../support/helpers.js";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("credentials store", () => {
  it("writes and reads stored credentials from the configured home directory", async () => {
    const homeDir = await createTempHomeDir();
    const credentials = createStoredCredentials();

    await writeCredentials(credentials, { homeDir });
    const stored = await readCredentials({ homeDir });
    const fileContents = await readFile(
      resolveCredentialsPaths({ homeDir }).filePath,
      "utf8",
    );

    expect(stored).toEqual(credentials);
    expect(fileContents).toContain('"access_token": "access-token"');
    expect(fileContents.endsWith("\n")).toBe(true);
    await expect(credentialsExist({ homeDir })).resolves.toBe(true);
  });

  it("reports missing credentials with a login hint", async () => {
    const homeDir = await createTempHomeDir();

    await expect(readCredentials({ homeDir })).rejects.toMatchObject({
      code: "CREDENTIALS_NOT_FOUND",
      message: "Not logged in. Run insighta login.",
    } satisfies Partial<CredentialsStoreError>);
    await expect(credentialsExist({ homeDir })).resolves.toBe(false);
  });

  it("rejects malformed credential files", async () => {
    const homeDir = await createTempHomeDir();
    const { directoryPath, filePath } = resolveCredentialsPaths({ homeDir });

    await mkdir(directoryPath, { recursive: true });
    await writeFile(filePath, "{not-json}", "utf8");

    await expect(readCredentials({ homeDir })).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    } satisfies Partial<CredentialsStoreError>);
  });

  it("deletes stored credentials and returns false when nothing is present", async () => {
    const homeDir = await createTempHomeDir();

    await expect(deleteCredentials({ homeDir })).resolves.toBe(false);

    await writeCredentials(createStoredCredentials(), { homeDir });
    await expect(deleteCredentials({ homeDir })).resolves.toBe(true);
    await expect(credentialsExist({ homeDir })).resolves.toBe(false);
  });
});

async function createTempHomeDir(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "insighta-cred-"));
  tempDirectories.push(directory);
  return directory;
}
