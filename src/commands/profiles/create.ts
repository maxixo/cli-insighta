import { Command } from "commander";

export function createProfilesCreateCommand(): Command {
  return new Command("create")
    .description("Create an Insighta profile")
    .action(async () => {
      throw new Error("insighta profiles create is not implemented yet.");
    });
}
