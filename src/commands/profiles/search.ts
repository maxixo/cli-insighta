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
import { createTokenManager } from "../../lib/token-manager.js";
import type {
  ProfileListParams,
  ProfileSortField,
  SearchProfilesResponse,
  SortOrder,
} from "../../types/api.js";

type OutputWriter = Pick<NodeJS.WriteStream, "write">;

type ProfilesSearchCommandOptions = {
  gender?: string;
  country?: string;
  ageGroup?: string;
  minAge?: number;
  maxAge?: number;
  sortBy?: ProfileSortField;
  order?: SortOrder;
  page?: number;
  limit?: number;
};

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
    .description("Search Insighta profiles")
    .option("--gender <value>", "Filter by gender")
    .option("--country <code>", "Filter by country code")
    .option("--age-group <value>", "Filter by age group")
    .option(
      "--min-age <number>",
      "Filter by minimum age",
      parseIntegerOption("min-age"),
    )
    .option(
      "--max-age <number>",
      "Filter by maximum age",
      parseIntegerOption("max-age"),
    )
    .option(
      "--sort-by <field>",
      "Sort by age, created_at, or gender_probability",
    )
    .option("--order <direction>", "Sort order: asc or desc")
    .option("--page <number>", "Page number", parseIntegerOption("page"))
    .option("--limit <number>", "Page size", parseIntegerOption("limit"))
    .action(async (query, options, command) => {
      try {
        const globalOptions = command.optsWithGlobals() as {
          baseUrl?: string;
        };

        await runProfilesSearchCommand({
          query,
          ...(options as ProfilesSearchCommandOptions),
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
  return {
    gender: options.gender,
    country_id: options.country,
    age_group: options.ageGroup,
    min_age: options.minAge,
    max_age: options.maxAge,
    sort_by: options.sortBy,
    order: options.order,
    page: options.page,
    limit: options.limit,
  };
}

function renderProfilesSearchResult(
  stdout: OutputWriter,
  response: SearchProfilesResponse,
): void {
  stdout.write(
    `${renderProfilesTable(response.data)}\n\n${renderPaginationSummary(response)}\n`,
  );
}

function parseIntegerOption(
  optionName: string,
): (value: string) => number {
  return (value: string) => {
    if (!/^-?\d+$/.test(value)) {
      throw new Error(
        `Invalid value for --${optionName}: expected an integer.`,
      );
    }

    return Number.parseInt(value, 10);
  };
}
