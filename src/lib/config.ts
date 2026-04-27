import { z } from "zod";

import { API_BASE_URL_ENV_VAR, DEFAULT_API_BASE_URL } from "./constants.js";

export type BaseUrlSource = "cli" | "env" | "stored" | "default";

export type ResolveConfigInput = {
  cliBaseUrl?: string | undefined;
  envBaseUrl?: string | undefined;
  storedBaseUrl?: string | undefined;
};

export type ResolvedConfig = {
  baseUrl: string;
  source: BaseUrlSource;
};

const baseUrlSchema = z
  .string()
  .trim()
  .min(1, "Base URL cannot be empty.")
  .url("Base URL must be a valid URL.")
  .transform((value) => value.replace(/\/+$/, ""));

function parseBaseUrl(value: string, sourceLabel: string): string {
  const parsed = baseUrlSchema.safeParse(value);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Base URL is invalid.";
    throw new Error(`Invalid ${sourceLabel}: ${message}`);
  }

  return parsed.data;
}

function pickConfiguredBaseUrl(input: ResolveConfigInput): {
  rawValue: string;
  source: Exclude<BaseUrlSource, "default">;
} | null {
  if (input.cliBaseUrl) {
    return {
      rawValue: input.cliBaseUrl,
      source: "cli",
    };
  }

  if (input.envBaseUrl) {
    return {
      rawValue: input.envBaseUrl,
      source: "env",
    };
  }

  if (input.storedBaseUrl) {
    return {
      rawValue: input.storedBaseUrl,
      source: "stored",
    };
  }

  return null;
}

export function resolveConfig(input: ResolveConfigInput = {}): ResolvedConfig {
  const configuredBaseUrl = pickConfiguredBaseUrl(input);

  if (!configuredBaseUrl) {
    return {
      baseUrl: DEFAULT_API_BASE_URL,
      source: "default",
    };
  }

  return {
    baseUrl: parseBaseUrl(
      configuredBaseUrl.rawValue,
      `${configuredBaseUrl.source} base URL`,
    ),
    source: configuredBaseUrl.source,
  };
}

export function readEnvBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const rawValue = env[API_BASE_URL_ENV_VAR];

  if (rawValue === undefined || rawValue.trim() === "") {
    return undefined;
  }

  return parseBaseUrl(rawValue, API_BASE_URL_ENV_VAR);
}
