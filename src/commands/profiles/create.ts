import { Command } from "commander";
import ora from "ora";

import { createApiClient, type ApiClient } from "../../lib/api-client.js";
import { readEnvBaseUrl, resolveConfig } from "../../lib/config.js";
import { readCredentials } from "../../lib/credentials-store.js";
import { formatError } from "../../lib/formatters/errors.js";
import { renderProfileDetails } from "../../lib/formatters/profile.js";
import { createTokenManager } from "../../lib/token-manager.js";

type OutputWriter = Pick<NodeJS.WriteStream, "write">;

type ProfilesCreateCommandOptions = {
  name: string;
};

type RunProfilesCreateCommandInput = ProfilesCreateCommandOptions & {
  baseUrl?: string;
  env?: NodeJS.ProcessEnv;
  stdout?: OutputWriter;
  createClient?: (options: { baseUrl: string }) => ApiClient;
  createAuthTokenManager?: typeof createTokenManager;
  readStoredCredentials?: typeof readCredentials;
};

export function createProfilesCreateCommand(): Command {
  return new Command("create")
    .description("Create an Insighta profile from a name")
    .requiredOption("--name <name>", "Profile name")
    .action(async (options, command) => {
      try {
        const globalOptions = command.optsWithGlobals() as {
          baseUrl?: string;
        };

        await runProfilesCreateCommand({
          ...(options as ProfilesCreateCommandOptions),
          baseUrl: globalOptions.baseUrl,
        });
      } catch (error) {
        process.exitCode = 1;
        process.stderr.write(`${formatError(error)}\n`);
      }
    });
}

export async function runProfilesCreateCommand(
  input: RunProfilesCreateCommandInput,
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
  const spinner = ora("Creating profile...");

  spinner.start();

  try {
    const profile = await tokenManager.withAuthenticatedRequest(
      async (accessToken) => client.createProfile(input.name, accessToken),
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
