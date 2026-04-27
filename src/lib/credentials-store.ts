import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import os from "node:os";
import path from "node:path";

import { storedCredentialsSchema, type StoredCredentials } from "../types/credentials.js";

const CREDENTIALS_DIRECTORY_NAME = ".insighta";
const CREDENTIALS_FILE_NAME = "credentials.json";
const DIRECTORY_MODE = 0o700;
const FILE_MODE = 0o600;

export type CredentialsPaths = {
  directoryPath: string;
  filePath: string;
};

export type CredentialsStoreOptions = {
  homeDir?: string;
};

export type CredentialsStoreErrorCode =
  | "CREDENTIALS_NOT_FOUND"
  | "INVALID_CREDENTIALS"
  | "READ_FAILED"
  | "WRITE_FAILED"
  | "DELETE_FAILED";

export class CredentialsStoreError extends Error {
  readonly code: CredentialsStoreErrorCode;

  constructor(code: CredentialsStoreErrorCode, message: string, cause?: unknown) {
    super(message, cause ? { cause } : undefined);
    this.name = "CredentialsStoreError";
    this.code = code;
  }
}

export function resolveCredentialsPaths(
  options: CredentialsStoreOptions = {},
): CredentialsPaths {
  const homeDir = options.homeDir ?? os.homedir();
  const directoryPath = path.join(homeDir, CREDENTIALS_DIRECTORY_NAME);

  return {
    directoryPath,
    filePath: path.join(directoryPath, CREDENTIALS_FILE_NAME),
  };
}

export async function credentialsExist(
  options: CredentialsStoreOptions = {},
): Promise<boolean> {
  const { filePath } = resolveCredentialsPaths(options);

  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch (error) {
    if (isMissingFileError(error)) {
      return false;
    }

    throw new CredentialsStoreError(
      "READ_FAILED",
      `Failed to access stored credentials at ${filePath}.`,
      error,
    );
  }
}

export async function readCredentials(
  options: CredentialsStoreOptions = {},
): Promise<StoredCredentials> {
  const { filePath } = resolveCredentialsPaths(options);

  let fileContents: string;

  try {
    fileContents = await readFile(filePath, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new CredentialsStoreError(
        "CREDENTIALS_NOT_FOUND",
        "Not logged in. Run insighta login.",
        error,
      );
    }

    throw new CredentialsStoreError(
      "READ_FAILED",
      `Failed to read stored credentials from ${filePath}.`,
      error,
    );
  }

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(fileContents) as unknown;
  } catch (error) {
    throw new CredentialsStoreError(
      "INVALID_CREDENTIALS",
      invalidCredentialsMessage(filePath),
      error,
    );
  }

  const parsedCredentials = storedCredentialsSchema.safeParse(parsedJson);

  if (!parsedCredentials.success) {
    throw new CredentialsStoreError(
      "INVALID_CREDENTIALS",
      invalidCredentialsMessage(filePath),
      parsedCredentials.error,
    );
  }

  return parsedCredentials.data;
}

export async function writeCredentials(
  credentials: StoredCredentials,
  options: CredentialsStoreOptions = {},
): Promise<StoredCredentials> {
  const { directoryPath, filePath } = resolveCredentialsPaths(options);
  const parsedCredentialsResult = storedCredentialsSchema.safeParse(credentials);

  if (!parsedCredentialsResult.success) {
    throw new CredentialsStoreError(
      "INVALID_CREDENTIALS",
      "Cannot store invalid credentials.",
      parsedCredentialsResult.error,
    );
  }

  const parsedCredentials = parsedCredentialsResult.data;
  const fileContents = `${JSON.stringify(parsedCredentials, null, 2)}\n`;

  try {
    await mkdir(directoryPath, {
      recursive: true,
      mode: DIRECTORY_MODE,
    });

    await writeFile(filePath, fileContents, {
      encoding: "utf8",
      mode: FILE_MODE,
    });
  } catch (error) {
    throw new CredentialsStoreError(
      "WRITE_FAILED",
      `Failed to write credentials to ${filePath}.`,
      error,
    );
  }

  return parsedCredentials;
}

export async function deleteCredentials(
  options: CredentialsStoreOptions = {},
): Promise<boolean> {
  const { filePath } = resolveCredentialsPaths(options);

  try {
    await rm(filePath, {
      force: false,
    });
    return true;
  } catch (error) {
    if (isMissingFileError(error)) {
      return false;
    }

    throw new CredentialsStoreError(
      "DELETE_FAILED",
      `Failed to delete credentials at ${filePath}.`,
      error,
    );
  }
}

function invalidCredentialsMessage(filePath: string): string {
  return `Stored credentials at ${filePath} are invalid. Run insighta logout then insighta login.`;
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
