import { Command } from "commander";
import ora from "ora";

import { createApiClient, type ApiClient } from "../../lib/api-client.js";
import { readEnvBaseUrl, resolveConfig } from "../../lib/config.js";
import { readCredentials } from "../../lib/credentials-store.js";
import { saveCsvExport } from "../../lib/csv.js";
import { formatError } from "../../lib/formatters/errors.js";
import { createTokenManager } from "../../lib/token-manager.js";
import type { ProfileListParams, ProfileSortField, SortOrder } from "../../types/api.js";

type OutputWriter = Pick<NodeJS.WriteStream, "write">;

type ProfilesExportCommandOptions = {
  format: "csv";
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

type RawProfilesExportCommandOptions = {
  format?: string;
  gender?: string;
  country?: string;
  ageGroup?: string;
  minAge?: string;
  maxAge?: string;
  sortBy?: ProfileSortField;
  order?: SortOrder;
  page?: string;
  limit?: string;
};

type RunProfilesExportCommandInput = ProfilesExportCommandOptions & {
  baseUrl?: string;
  env?: NodeJS.ProcessEnv;
  stdout?: OutputWriter;
  cwd?: string;
  createClient?: (options: { baseUrl: string }) => ApiClient;
  createAuthTokenManager?: typeof createTokenManager;
  readStoredCredentials?: typeof readCredentials;
  saveCsv?: typeof saveCsvExport;
  now?: () => Date;
};

export function createProfilesExportCommand(): Command {
  return new Command("export")
    .description("Export Insighta profiles")
    .requiredOption("--format <format>", "Export format (csv only)")
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
    .action(async (options, command) => {
      try {
        const globalOptions = command.optsWithGlobals() as {
          baseUrl?: string;
        };

        await runProfilesExportCommand({
          ...normalizeProfilesExportCommandOptions(
            options as RawProfilesExportCommandOptions,
          ),
          baseUrl: globalOptions.baseUrl,
        });
      } catch (error) {
        process.exitCode = 1;
        process.stderr.write(`${formatError(error)}\n`);
      }
    });
}

export async function runProfilesExportCommand(
  input: RunProfilesExportCommandInput,
): Promise<void> {
  const stdout = input.stdout ?? process.stdout;
  const createClient = input.createClient ?? createApiClient;
  const createAuthTokenManager =
    input.createAuthTokenManager ?? createTokenManager;
  const readStoredCredentials = input.readStoredCredentials ?? readCredentials;
  const saveCsv = input.saveCsv ?? saveCsvExport;
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
  const spinner = ora("Exporting profiles...");

  spinner.start();

  try {
    const csv = await tokenManager.withAuthenticatedRequest(
      async (accessToken) =>
        client.exportProfilesCsv(buildProfilesExportParams(input), accessToken),
      {
        credentials,
      },
    );
    const savedExport = await saveCsv({
      csv,
      cwd: input.cwd,
      now: input.now,
    });

    spinner.stop();
    renderExportSuccess(stdout, savedExport.filePath, savedExport.rowCount);
  } catch (error) {
    spinner.stop();
    throw error;
  }
}

export function buildProfilesExportParams(
  options: Omit<ProfilesExportCommandOptions, "format">,
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

function renderExportSuccess(
  stdout: OutputWriter,
  filePath: string,
  rowCount: number,
): void {
  stdout.write(`Saved CSV export to ${filePath}\n`);
  stdout.write(`Rows: ${rowCount}\n`);
}

function normalizeProfilesExportCommandOptions(
  options: RawProfilesExportCommandOptions,
): ProfilesExportCommandOptions {
  return {
    format: parseCsvFormat(options.format),
    gender: options.gender,
    country: options.country,
    ageGroup: options.ageGroup,
    minAge: parseIntegerOption("min-age", options.minAge),
    maxAge: parseIntegerOption("max-age", options.maxAge),
    sortBy: options.sortBy,
    order: options.order,
    page: parseIntegerOption("page", options.page),
    limit: parseIntegerOption("limit", options.limit),
  };
}

function parseCsvFormat(value: string | undefined): "csv" {
  if (value !== "csv") {
    throw new Error(
      "Invalid value for --format: expected csv.",
    );
  }

  return "csv";
}

function parseIntegerOption(
  optionName: string,
  value: string | undefined,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!/^-?\d+$/.test(value)) {
    throw new Error(`Invalid value for --${optionName}: expected an integer.`);
  }

  return Number.parseInt(value, 10);
}
