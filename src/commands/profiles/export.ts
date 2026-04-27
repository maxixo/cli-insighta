import { Command } from "commander";

export function createProfilesExportCommand(): Command {
  return new Command("export")
    .description("Export Insighta profiles")
    .action(async () => {
      throw new Error("insighta profiles export is not implemented yet.");
    });
}
