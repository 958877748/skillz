/**
 * Core type definitions for Skillz MCP server
 */

import { PathLike } from "fs";

/**
 * Skill metadata extracted from YAML front matter
 */
export interface SkillMetadata {
  name: string;
  description: string;
  license?: string;
  allowedTools: string[];
  extra: Record<string, any>;
}

/**
 * Resource metadata following MCP specification
 */
export interface SkillResourceMetadata {
  uri: string;
  name: string;
  mimeType?: string;
}

/**
 * Skill representation (directory or zip-based)
 */
export interface Skill {
  slug: string;
  directory: string;
  instructionsPath: string;
  metadata: SkillMetadata;
  resources: string[];
  zipPath?: string;
  zipRootPrefix?: string;
}

/**
 * Parsed SKILL.md content
 */
export interface ParsedSkillMd {
  metadata: SkillMetadata;
  body: string;
}

/**
 * Error types
 */
export class SkillError extends Error {
  public readonly code: string;

  constructor(message: string, code: string = "skill_error") {
    super(message);
    this.name = "SkillError";
    this.code = code;
  }
}

export class SkillValidationError extends SkillError {
  constructor(message: string) {
    super(message, "validation_error");
    this.name = "SkillValidationError";
  }
}

/**
 * CLI arguments
 */
export interface CliArgs {
  skillsRoot: string;
  transport: "stdio" | "http" | "sse";
  host: string;
  port: number;
  path: string;
  listSkills: boolean;
  verbose: boolean;
  log: boolean;
}
