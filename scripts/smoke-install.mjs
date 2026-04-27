import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

async function main() {
  const tempRoot = await mkdtemp(path.join(repoRoot, ".smoke-install-"));
  const prefixDirectory = path.join(tempRoot, "prefix");
  const workingDirectory = path.join(tempRoot, "cwd");

  await mkdir(prefixDirectory, { recursive: true });
  await mkdir(workingDirectory, { recursive: true });

  try {
    await runCommand(npmCommand, ["run", "build"], {
      cwd: repoRoot,
    });

    const packResult = await runCommand(
      npmCommand,
      ["pack", "--dry-run", "--json"],
      {
        cwd: repoRoot,
      },
    );
    const packedFiles = new Set(
      parsePackFiles(packResult.stdout),
    );

    assert(
      packedFiles.has("package.json"),
      "Package smoke check failed: package.json is missing from the npm pack output.",
    );
    assert(
      packedFiles.has("dist/bin/insighta.js"),
      "Package smoke check failed: dist/bin/insighta.js is missing from the npm pack output.",
    );
    assert(
      packedFiles.has("dist/cli.js"),
      "Package smoke check failed: dist/cli.js is missing from the npm pack output.",
    );

    await runCommand(
      npmCommand,
      ["install", "-g", ".", "--prefix", prefixDirectory],
      {
        cwd: repoRoot,
      },
    );

    const commandPath = resolveInstalledCommandPath(prefixDirectory);
    const helpResult = await runCommand(
      commandPath.command,
      commandPath.args,
      {
        cwd: workingDirectory,
        env: {
          ...process.env,
          PATH: `${commandPath.binDirectory}${path.delimiter}${process.env.PATH ?? ""}`,
        },
      },
    );

    assert(
      helpResult.stdout.includes("Usage: insighta"),
      "Help smoke check failed: expected the installed insighta command to print usage information.",
    );
    assert(
      helpResult.stdout.includes("login"),
      "Help smoke check failed: expected the installed insighta command to list the login command.",
    );
    assert(
      helpResult.stdout.includes("profiles"),
      "Help smoke check failed: expected the installed insighta command to list the profiles command.",
    );

    process.stdout.write(
      "Smoke checks passed: npm pack, npm install -g ., and insighta --help.\n",
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

function parsePackFiles(output) {
  const parsed = JSON.parse(output);
  const files = parsed[0]?.files;

  if (!Array.isArray(files)) {
    throw new Error("npm pack --dry-run --json did not return a files list.");
  }

  return files.map((file) => file.path);
}

function resolveInstalledCommandPath(prefixDirectory) {
  if (process.platform === "win32") {
    return {
      binDirectory: prefixDirectory,
      command: "insighta",
      args: ["--help"],
    };
  }

  return {
    binDirectory: path.join(prefixDirectory, "bin"),
    command: "insighta",
    args: ["--help"],
  };
}

function runCommand(command, args, options) {
  return new Promise((resolve, reject) => {
    const resolvedCommand = resolveSpawnCommand(command, args);
    let child;

    try {
      child = spawn(resolvedCommand.command, resolvedCommand.args, {
        cwd: options.cwd,
        env: options.env,
        shell: options.shell ?? false,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (error) {
      reject(
        new Error(
          `Command failed to start: ${command} ${args.join(" ")}\n${error instanceof Error ? error.message : String(error)}`,
        ),
      );
      return;
    }

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(
        new Error(
          `Command failed to start: ${command} ${args.join(" ")}\n${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        new Error(
          `Command failed: ${command} ${args.join(" ")}\n${stderr || stdout}`,
        ),
      );
    });
  });
}

function resolveSpawnCommand(command, args) {
  if (process.platform !== "win32") {
    return { command, args };
  }

  return {
    command: process.env.ComSpec ?? "cmd.exe",
    args: ["/d", "/s", "/c", formatWindowsCommand(command, args)],
  };
}

function formatWindowsCommand(command, args) {
  return [command, ...args].map(quoteWindowsArgument).join(" ");
}

function quoteWindowsArgument(value) {
  if (value.length === 0) {
    return "\"\"";
  }

  if (!/[ \t"]/u.test(value)) {
    return value;
  }

  return `"${value.replaceAll("\"", "\\\"")}"`;
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
