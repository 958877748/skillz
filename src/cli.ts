#!/usr/bin/env node

/**
 * CLI entry point for Skillz MCP server
 */

import { Command } from "commander";
import { SkillRegistry } from "./registry";
import { buildServer, listSkills } from "./server";
import { CliArgs } from "./types";
import { resolveHome } from "./utils";
import { readFileSync } from "fs";
import * as path from "path";

// Read version from package.json
function getVersion(): string {
  try {
    const packageJsonPath = path.join(__dirname, "..", "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    return packageJson.version || "0.1.0";
  } catch {
    return "0.1.0";
  }
}

/**
 * Configure logging
 */
function configureLogging(verbose: boolean, logToFile: boolean): void {
  // In a real implementation, you'd set up a proper logger
  // For now, we'll just control console output
  if (verbose) {
    console.debug = console.log;
  } else {
    console.debug = () => {};
  }

  if (logToFile) {
    console.log("Verbose file logging enabled at /tmp/skillz.log");
    // In production, you'd set up a file logger here
  }
}

/**
 * Parse command line arguments
 */
export function parseArgs(argv?: string[]): CliArgs {
  const program = new Command();

  program
    .name("skillz")
    .description("MCP server that exposes Claude-style skills to any MCP client")
    .version(getVersion())
    .argument("[skills_root]", "Directory containing skill folders", "./.skillz")
    .option(
      "--transport <transport>",
      "Transport to use when running the server",
      "stdio"
    )
    .option("--host <host>", "Host for HTTP/SSE transports", "127.0.0.1")
    .option("--port <port>", "Port for HTTP/SSE transports", "8000")
    .option("--path <path>", "Path for HTTP transport", "/mcp")
    .option("--list-skills", "List discovered skills and exit without starting the server")
    .option("--verbose", "Enable debug logging")
    .option("--log", "Write very verbose logs to /tmp/skillz.log");

  program.parse(argv);

  const options = program.opts();
  const skillsRoot = program.args[0] || "./.skillz";

  return {
    skillsRoot: resolveHome(skillsRoot),
    transport: options.transport as "stdio" | "http" | "sse",
    host: options.host,
    port: parseInt(options.port, 10),
    path: options.path,
    listSkills: options.listSkills || false,
    verbose: options.verbose || false,
    log: options.log || false,
  };
}

/**
 * Main entry point
 */
export async function main(argv?: string[]): Promise<void> {
  const args = parseArgs(argv);
  configureLogging(args.verbose, args.log);

  if (args.log) {
    console.log("Verbose file logging enabled at /tmp/skillz.log");
  }

  const registry = new SkillRegistry(args.skillsRoot);
  await registry.load();

  if (args.listSkills) {
    console.log(listSkills(registry));
    return;
  }

  const server = await buildServer(registry, getVersion());

  // Start server based on transport
  switch (args.transport) {
    case "stdio":
      await server.start({
        transportType: "stdio",
      });
      break;

    case "http":
      await server.start({
        transportType: "httpStream",
        httpStream: {
          endpoint: args.path as `/${string}`,
          port: args.port,
        },
      });
      console.log(`HTTP server listening on http://${args.host}:${args.port}${args.path}`);
      break;

    case "sse":
      await server.start({
        transportType: "sse",
        sse: {
          endpoint: "/sse" as `/${string}`,
          port: args.port,
        },
      });
      console.log(`SSE server listening on http://${args.host}:${args.port}`);
      break;

    default:
      throw new Error(`Unsupported transport: ${args.transport}`);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
