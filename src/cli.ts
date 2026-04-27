import { Command } from "commander";

import { createLoginCommand } from "./commands/auth/login.js";
import { createLogoutCommand } from "./commands/auth/logout.js";
import { createWhoAmICommand } from "./commands/auth/whoami.js";
import { createProfilesCreateCommand } from "./commands/profiles/create.js";
import { createProfilesExportCommand } from "./commands/profiles/export.js";
import { createProfilesGetCommand } from "./commands/profiles/get.js";
import { createProfilesListCommand } from "./commands/profiles/list.js";
import { createProfilesSearchCommand } from "./commands/profiles/search.js";
import { CLI_DESCRIPTION, CLI_NAME, CLI_VERSION } from "./lib/constants.js";

export function buildProgram(): Command {
  const program = new Command();
  const profilesCommand = new Command("profiles")
    .description("List, inspect, search, create, and export Insighta profiles");

  program
    .name(CLI_NAME)
    .description(CLI_DESCRIPTION)
    .version(CLI_VERSION)
    .option("--base-url <url>", "Override the Insighta API base URL")
    .showHelpAfterError()
    .showSuggestionAfterError()
    .addHelpText(
      "afterAll",
      [
        "",
        "Examples:",
        "  insighta login",
        "  insighta whoami --base-url https://api.insighta.example",
        "  insighta profiles list --country NG --page 2",
        "  insighta profiles search \"Ada\" --gender female",
        "  insighta profiles export --format csv --country NG",
      ].join("\n"),
    );

  profilesCommand
    .addCommand(createProfilesListCommand())
    .addCommand(createProfilesGetCommand())
    .addCommand(createProfilesSearchCommand())
    .addCommand(createProfilesCreateCommand())
    .addCommand(createProfilesExportCommand());

  program
    .addCommand(createLoginCommand())
    .addCommand(createLogoutCommand())
    .addCommand(createWhoAmICommand())
    .addCommand(profilesCommand);

  return program;
}

export async function run(argv: string[]): Promise<void> {
  const program = buildProgram();

  await program.parseAsync(argv);
}
