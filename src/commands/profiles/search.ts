import { Command } from "commander";
import ora from "ora";

import { createApiClient, type ApiClient } from "../../lib/api-client.js";
import { readEnvBaseUrl, resolveConfig } from "../../lib/config.js";
import { readCredentials } from "../../lib/credentials-store.js";
import { formatError } from "../../lib/formatters/errors.js";
import {
  renderPaginationSummary,
  renderProfilesTable,
} from "../../lib/formatters/profile.js";
import {
  buildProfileListParams,
  type NormalizedProfileFilterOptions,
  type RawProfileFilterOptions,
  validateAndNormalizeProfileFilters,
} from "../../lib/profile-filters.js";
import { createTokenManager } from "../../lib/token-manager.js";
import type { ProfileListParams, SearchProfilesResponse } from "../../types/api.js";

type OutputWriter = Pick<NodeJS.WriteStream, "write">;

type ProfilesSearchCommandOptions = NormalizedProfileFilterOptions;

type RunProfilesSearchCommandInput = ProfilesSearchCommandOptions & {
  query: string;
  baseUrl?: string;
  env?: NodeJS.ProcessEnv;
  stdout?: OutputWriter;
  createClient?: (options: { baseUrl: string }) => ApiClient;
  createAuthTokenManager?: typeof createTokenManager;
  readStoredCredentials?: typeof readCredentials;
};

export function createProfilesSearchCommand(): Command {
  return new Command("search")
    .argument("<query>", "Search query")
    .description("Search Insighta profiles by query")
    .option("--gender <value>", "Filter by gender")
    .option("--country <code>", "Filter by country code")
    .option("--age-group <value>", "Filter by age group")
    .option("--min-age <number>", "Filter by minimum age")
    .option("--max-age <number>", "Filter by maximum age")
    .option(
      "--sort-by <field>",
      "Sort by age, created_at, or gender_probability",
    )
    .option("--order <direction>", "Sort order: asc or desc")
    .option("--page <number>", "Page number")
    .option("--limit <number>", "Page size")
    .action(async (query, options, command) => {
      try {
        const globalOptions = command.optsWithGlobals() as {
          baseUrl?: string;
        };

        await runProfilesSearchCommand({
          query,
          ...validateAndNormalizeProfileFilters(
            options as RawProfileFilterOptions,
          ),
          baseUrl: globalOptions.baseUrl,
        });
      } catch (error) {
        process.exitCode = 1;
        process.stderr.write(`${formatError(error)}\n`);
      }
    });
}

export async function runProfilesSearchCommand(
  input: RunProfilesSearchCommandInput,
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
  const spinner = ora("Searching profiles...");

  spinner.start();

  try {
    const response = await tokenManager.withAuthenticatedRequest(
      async (accessToken) =>
        client.searchProfiles(
          input.query,
          buildProfilesSearchParams(input),
          accessToken,
        ),
      {
        credentials,
      },
    );

    spinner.stop();
    renderProfilesSearchResult(stdout, response);
  } catch (error) {
    spinner.stop();
    throw error;
  }
}

export function buildProfilesSearchParams(
  options: ProfilesSearchCommandOptions,
): ProfileListParams {
  return buildProfileListParams(options);
}

function renderProfilesSearchResult(
  stdout: OutputWriter,
  response: SearchProfilesResponse,
): void {
  stdout.write(
    `${renderProfilesTable(response.data)}\n\n${renderPaginationSummary(response)}\n`,
  );
}
