import { Command } from "commander";

export function createWhoAmICommand(): Command {
  return new Command("whoami")
    .description("Show the current authenticated Insighta user")
    .action(async () => {
      throw new Error("insighta whoami is not implemented yet.");
    });
}
