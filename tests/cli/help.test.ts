import { describe, expect, it } from "vitest";

import { buildProgram } from "../../src/cli.js";
import { createStringWriter } from "../support/helpers.js";

describe("cli help", () => {
  it("renders top-level help with examples and primary commands", () => {
    const program = buildProgram();
    const stdout = createStringWriter();

    program.configureOutput({
      writeOut: (value) => {
        stdout.writer.write(value);
      },
    });
    program.outputHelp();

    const help = stdout.output();

    expect(help).toContain("Usage: insighta [options] [command]");
    expect(help).toContain(
      "Authenticate with Insighta and manage profiles from the terminal",
    );
    expect(help).toContain("--base-url <url>");
    expect(help).toContain("login");
    expect(help).toContain("logout");
    expect(help).toContain("whoami");
    expect(help).toContain("profiles");
    expect(help).toContain("Examples:");
    expect(help).toContain("insighta profiles export --format csv --country NG");
  });

  it("renders profile command help with the full subcommand set", () => {
    const profilesCommand = buildProgram().commands.find(
      (command) => command.name() === "profiles",
    );

    expect(profilesCommand).toBeDefined();

    const help = profilesCommand?.helpInformation() ?? "";

    expect(help).toContain("insighta profiles");
    expect(help).toContain("list");
    expect(help).toContain("get");
    expect(help).toContain("search");
    expect(help).toContain("create");
    expect(help).toContain("export");
    expect(help).toContain("List, inspect, search, create, and export Insighta profiles");
  });
});
