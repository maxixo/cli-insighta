import { Command } from "commander";

export function createLoginCommand(): Command {
  return new Command("login")
    .description("Authenticate with Insighta using GitHub OAuth")
    .action(async () => {
      throw new Error("insighta login is not implemented yet.");
    });
}
