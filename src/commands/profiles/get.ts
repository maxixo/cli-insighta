import { Command } from "commander";

export function createProfilesGetCommand(): Command {
  return new Command("get")
    .argument("<id>", "Profile identifier")
    .description("Get a single Insighta profile by id")
    .action(async () => {
      throw new Error("insighta profiles get is not implemented yet.");
    });
}
