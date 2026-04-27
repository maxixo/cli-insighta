import { Command } from "commander";
import ora from "ora";

import { createApiClient, type ApiClient } from "../../lib/api-client.js";
import { readEnvBaseUrl, resolveConfig } from "../../lib/config.js";
import { readCredentials } from "../../lib/credentials-store.js";
import { formatError } from "../../lib/formatters/errors.js";
import { renderProfileDetails } from "../../lib/formatters/profile.js";
import { createTokenManager } from "../../lib/token-manager.js";

type OutputWriter = Pick<NodeJS.WriteStream, "write">;

type RunProfilesGetCommandInput = {
  id: string;
  baseUrl?: string;
  env?: NodeJS.ProcessEnv;
  stdout?: OutputWriter;
  createClient?: (options: { baseUrl: string }) => ApiClient;
  createAuthTokenManager?: typeof createTokenManager;
  readStoredCredentials?: typeof readCredentials;
};

export function createProfilesGetCommand(): Command {
  return new Command("get")
    .argument("<id>", "Profile identifier")
    .description("Get a single Insighta profile by id")
    .action(async (id, _options, command) => {
      try {
        const globalOptions = command.optsWithGlobals() as {
          baseUrl?: string;
        };

        await runProfilesGetCommand({
          id,
          baseUrl: globalOptions.baseUrl,
        });
      } catch (error) {
        process.exitCode = 1;
        process.stderr.write(`${formatError(error)}\n`);
      }
    });
}

export async function runProfilesGetCommand(
  input: RunProfilesGetCommandInput,
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
  const spinner = ora("Fetching profile...");

  spinner.start();

  try {
    const profile = await tokenManager.withAuthenticatedRequest(
      async (accessToken) => client.getProfile(input.id, accessToken),
      {
        credentials,
      },
    );

    spinner.stop();
    stdout.write(`${renderProfileDetails(profile)}\n`);
  } catch (error) {
    spinner.stop();
    throw error;
  }
}
