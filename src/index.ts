/**
 * Main entry point for the Skillz package
 */

export { SkillRegistry } from "./registry";
export { buildServer, listSkills } from "./server";
export { parseArgs, main } from "./cli";
export * from "./types";
export * from "./utils";
export * from "./resources";

// Version will be injected by build process
export const version = "0.1.14";
