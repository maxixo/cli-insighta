import { Command } from "commander";

export function createLogoutCommand(): Command {
  return new Command("logout")
    .description("Log out of Insighta")
    .action(async () => {
      throw new Error("insighta logout is not implemented yet.");
    });
}
