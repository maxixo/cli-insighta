import { Command } from "commander";

export function createProfilesListCommand(): Command {
  return new Command("list")
    .description("List Insighta profiles")
    .action(async () => {
      throw new Error("insighta profiles list is not implemented yet.");
    });
}
