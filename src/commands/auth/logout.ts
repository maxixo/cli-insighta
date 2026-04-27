import { Command } from "commander";
import ora from "ora";

import { ApiClientError, createApiClient, type ApiClient } from "../../lib/api-client.js";
import { readEnvBaseUrl, resolveConfig } from "../../lib/config.js";
import {
  CredentialsStoreError,
  deleteCredentials,
  readCredentials,
} from "../../lib/credentials-store.js";
import { formatError } from "../../lib/formatters/errors.js";
import type { StoredCredentials } from "../../types/credentials.js";

type OutputWriter = Pick<NodeJS.WriteStream, "write">;

type RunLogoutCommandInput = {
  baseUrl?: string;
  env?: NodeJS.ProcessEnv;
  stdout?: OutputWriter;
  stderr?: OutputWriter;
  createClient?: (options: { baseUrl: string }) => ApiClient;
  readStoredCredentials?: typeof readCredentials;
  deleteStoredCredentials?: typeof deleteCredentials;
};

export function createLogoutCommand(): Command {
  return new Command("logout")
    .description("Revoke the current Insighta session and remove local credentials")
    .action(async (_options, command) => {
      try {
        const globalOptions = command.optsWithGlobals() as {
          baseUrl?: string;
        };

        await runLogoutCommand({
          baseUrl: globalOptions.baseUrl,
        });
      } catch (error) {
        process.exitCode = 1;
        process.stderr.write(`${formatError(error)}\n`);
      }
    });
}

export async function runLogoutCommand(
  input: RunLogoutCommandInput = {},
): Promise<void> {
  const stdout = input.stdout ?? process.stdout;
  const stderr = input.stderr ?? process.stderr;
  const createClient = input.createClient ?? createApiClient;
  const readStoredCredentials = input.readStoredCredentials ?? readCredentials;
  const deleteStoredCredentials =
    input.deleteStoredCredentials ?? deleteCredentials;

  let credentials: StoredCredentials;

  try {
    credentials = await readStoredCredentials();
  } catch (error) {
    if (
      error instanceof CredentialsStoreError &&
      error.code === "CREDENTIALS_NOT_FOUND"
    ) {
      stdout.write("Already logged out.\n");
      return;
    }

    if (
      error instanceof CredentialsStoreError &&
      error.code === "INVALID_CREDENTIALS"
    ) {
      await deleteStoredCredentials();
      stdout.write("Removed invalid local credentials.\n");
      return;
    }

    throw error;
  }

  const resolvedConfig = resolveConfig({
    cliBaseUrl: input.baseUrl,
    envBaseUrl: readEnvBaseUrl(input.env),
    storedBaseUrl: credentials.base_url,
  });
  const client = createClient({
    baseUrl: resolvedConfig.baseUrl,
  });
  const spinner = ora("Logging out...");
  let logoutError: unknown;

  spinner.start();

  try {
    await client.logoutSession(credentials.refresh_token);
  } catch (error) {
    logoutError = error;
  } finally {
    spinner.stop();
  }

  await deleteStoredCredentials();

  if (logoutError && !isUnauthorizedApiError(logoutError)) {
    stdout.write("Local credentials removed.\n");
    stderr.write(
      `Server logout request failed: ${formatError(logoutError)}\n`,
    );
    return;
  }

  stdout.write("Logged out of Insighta.\n");
}

function isUnauthorizedApiError(error: unknown): boolean {
  return error instanceof ApiClientError && error.statusCode === 401;
}
