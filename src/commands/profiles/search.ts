import { Command } from "commander";

export function createProfilesSearchCommand(): Command {
  return new Command("search")
    .argument("<query>", "Search query")
    .description("Search Insighta profiles")
    .action(async () => {
      throw new Error("insighta profiles search is not implemented yet.");
    });
}
