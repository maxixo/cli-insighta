import { Command } from "commander";

import { CLI_DESCRIPTION, CLI_NAME, CLI_VERSION } from "./lib/constants.js";

export function buildProgram(): Command {
  const program = new Command();

  program
    .name(CLI_NAME)
    .description(CLI_DESCRIPTION)
    .version(CLI_VERSION)
    .showHelpAfterError();

  return program;
}

export async function run(argv: string[]): Promise<void> {
  const program = buildProgram();

  await program.parseAsync(argv);
}
