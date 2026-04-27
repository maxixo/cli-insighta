import { Command } from "commander";

const CLI_VERSION = "0.1.0";

export function buildProgram(): Command {
  const program = new Command();

  program
    .name("insighta")
    .description("Insighta CLI")
    .version(CLI_VERSION)
    .showHelpAfterError();

  return program;
}

export async function run(argv: string[]): Promise<void> {
  const program = buildProgram();

  await program.parseAsync(argv);
}
