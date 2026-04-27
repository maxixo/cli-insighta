import { Command } from "commander";
import ora from "ora";

import { createApiClient, type ApiClient } from "../../lib/api-client.js";
import { readEnvBaseUrl, resolveConfig } from "../../lib/config.js";
import { formatError } from "../../lib/formatters/errors.js";
import { renderKeyValueTable } from "../../lib/formatters/table.js";
import { readCredentials } from "../../lib/credentials-store.js";
import { createTokenManager } from "../../lib/token-manager.js";
import type { User } from "../../types/api.js";

type OutputWriter = Pick<NodeJS.WriteStream, "write">;

type RunWhoAmICommandInput = {
  baseUrl?: string;
  env?: NodeJS.ProcessEnv;
  stdout?: OutputWriter;
  createClient?: (options: { baseUrl: string }) => ApiClient;
  createAuthTokenManager?: typeof createTokenManager;
  readStoredCredentials?: typeof readCredentials;
};

export function createWhoAmICommand(): Command {
  return new Command("whoami")
    .description("Show the currently authenticated Insighta user")
    .action(async (_options, command) => {
      try {
        const globalOptions = command.optsWithGlobals() as {
          baseUrl?: string;
        };

        await runWhoAmICommand({
          baseUrl: globalOptions.baseUrl,
        });
      } catch (error) {
        process.exitCode = 1;
        process.stderr.write(`${formatError(error)}\n`);
      }
    });
}

export async function runWhoAmICommand(
  input: RunWhoAmICommandInput = {},
): Promise<void> {
  const stdout = input.stdout ?? process.stdout;
  const createClient = input.createClient ?? createApiClient;
  const createAuthTokenManager =
    input.createAuthTokenManager ?? createTokenManager;
  const readStoredCredentials = input.readStoredCredentials ?? readCredentials;
  const credentials = await readStoredCredentials();
  const resolvedConfig = resolveConfig({
    cliBaseUrl: input.baseUrl,
    envBaseUrl: readEnvBaseUrl(input.env),
    storedBaseUrl: credentials.base_url,
  });
  const client = createClient({
    baseUrl: resolvedConfig.baseUrl,
  });
  const tokenManager = createAuthTokenManager({
    apiClient: client,
  });
  const spinner = ora("Fetching current user...");

  spinner.start();

  try {
    const user = await tokenManager.withAuthenticatedRequest(
      async (accessToken) => client.getCurrentUser(accessToken),
      {
        credentials,
      },
    );

    spinner.stop();
    renderUserTable(stdout, user);
  } catch (error) {
    spinner.stop();
    throw error;
  }
}

function renderUserTable(
  stdout: OutputWriter,
  user: User,
): void {
  const rows: Array<[string, string]> = [["ID", user.id]];

  if (user.github_id) {
    rows.push(["GitHub ID", user.github_id]);
  }

  if (user.username) {
    rows.push(["Username", user.username]);
  }

  if (user.name) {
    rows.push(["Name", user.name]);
  }

  if (user.email) {
    rows.push(["Email", user.email]);
  }

  stdout.write(`${renderKeyValueTable(rows)}\n`);
}
