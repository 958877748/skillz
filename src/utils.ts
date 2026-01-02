/**
 * Utility functions for Skillz MCP server
 */

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { SkillValidationError, ParsedSkillMd, SkillMetadata } from "./types";

// Pattern to match YAML front matter
const FRONT_MATTER_PATTERN =
  /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)/;

export const SKILL_MARKDOWN = "SKILL.md";

/**
 * Convert names into stable slug identifiers
 */
export function slugify(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "skill";
}

/**
 * Parse SKILL.md front matter and body
 */
export function parseSkillMd(
  content: string,
  filePath?: string
): ParsedSkillMd {
  const match = FRONT_MATTER_PATTERN.exec(content);
  if (!match) {
    throw new SkillValidationError(
      `${filePath || "SKILL.md"} must begin with YAML front matter delimited by '---'.`
    );
  }

  const frontMatter = match[1];
  const body = match[2];

  let data: any;
  try {
    data = yaml.load(frontMatter) || {};
  } catch (error) {
    throw new SkillValidationError(
      `Unable to parse YAML in ${filePath || "SKILL.md"}: ${error}`
    );
  }

  if (typeof data !== "object" || data === null) {
    throw new SkillValidationError(
      `Front matter in ${
        filePath || "SKILL.md"
      } must define a mapping, not ${typeof data}.`
    );
  }

  const name = String(data.name || "").trim();
  const description = String(data.description || "").trim();

  if (!name) {
    throw new SkillValidationError(
      `Front matter in ${filePath || "SKILL.md"} is missing 'name'.`
    );
  }
  if (!description) {
    throw new SkillValidationError(
      `Front matter in ${
        filePath || "SKILL.md"
      } is missing 'description'.`
    );
  }

  // Parse allowed tools (support both kebab-case and snake_case)
  const allowed =
    data["allowed-tools"] ||
    data.allowed_tools ||
    data["allowed-tools"] ||
    [];

  let allowedTools: string[] = [];
  if (typeof allowed === "string") {
    allowedTools = allowed
      .split(",")
      .map((part: string) => part.trim())
      .filter((part: string) => part);
  } else if (Array.isArray(allowed)) {
    allowedTools = allowed
      .map((item: any) => String(item).trim())
      .filter((item: string) => item);
  }

  // Collect extra fields
  const extra: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (
      ![
        "name",
        "description",
        "license",
        "allowed-tools",
        "allowed_tools",
      ].includes(key)
    ) {
      extra[key] = value;
    }
  }

  const metadata: SkillMetadata = {
    name,
    description,
    license: data.license ? String(data.license).trim() : undefined,
    allowedTools,
    extra,
  };

  return {
    metadata,
    body: body.trimStart(),
  };
}

/**
 * Read file content as string
 */
export function readFileSync(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8");
}

/**
 * Read file content as bytes (Buffer)
 */
export function readFileBytesSync(filePath: string): Buffer {
  return fs.readFileSync(filePath);
}

/**
 * Check if a path exists
 */
export function existsSync(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * Check if a path is a directory
 */
export function isDirectory(filePath: string): boolean {
  return fs.statSync(filePath).isDirectory();
}

/**
 * Check if a path is a file
 */
export function isFile(filePath: string): boolean {
  return fs.statSync(filePath).isFile();
}

/**
 * Get all files in a directory recursively
 */
export function getAllFiles(
  dirPath: string,
  exclude?: (filePath: string) => boolean
): string[] {
  const files: string[] = [];

  function traverse(currentPath: string) {
    const entries = fs.readdirSync(currentPath);

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry);

      if (exclude && exclude(fullPath)) {
        continue;
      }

      if (isDirectory(fullPath)) {
        traverse(fullPath);
      } else if (isFile(fullPath)) {
        files.push(fullPath);
      }
    }
  }

  traverse(dirPath);
  return files;
}

/**
 * Get relative path from base directory
 */
export function getRelativePath(from: string, to: string): string {
  return path.relative(from, to);
}

/**
 * Join path segments
 */
export function joinPath(...segments: string[]): string {
  return path.join(...segments);
}

/**
 * Get file extension
 */
export function getExtension(filePath: string): string {
  return path.extname(filePath);
}

/**
 * Get file name without directory
 */
export function getBasename(filePath: string): string {
  return path.basename(filePath);
}

/**
 * Resolve home directory (~)
 */
export function resolveHome(filePath: string): string {
  if (filePath.startsWith("~")) {
    return path.join(process.env.HOME || "", filePath.slice(1));
  }
  return filePath;
}

/**
 * Detect MIME type based on file extension
 */
export function detectMimeType(filePath: string): string | undefined {
  const ext = getExtension(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".py": "text/x-python",
    ".js": "text/javascript",
    ".ts": "text/typescript",
    ".json": "application/json",
    ".yaml": "text/yaml",
    ".yml": "text/yaml",
    ".xml": "text/xml",
    ".html": "text/html",
    ".css": "text/css",
    ".sh": "application/x-sh",
    ".bin": "application/octet-stream",
    ".dat": "application/octet-stream",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
  };
  return mimeTypes[ext];
}

/**
 * Check if a file is a zip file
 */
export function isZipFile(filePath: string): boolean {
  const ext = getExtension(filePath).toLowerCase();
  return ext === ".zip" || ext === ".skill";
}

/**
 * Encode content to base64
 */
export function encodeBase64(content: Buffer | string): string {
  if (typeof content === "string") {
    return Buffer.from(content).toString("base64");
  }
  return content.toString("base64");
}

/**
 * Decode base64 content
 */
export function decodeBase64(content: string): Buffer {
  return Buffer.from(content, "base64");
}

/**
 * Check if content is valid UTF-8 text
 */
export function isValidUtf8(buffer: Buffer): boolean {
  try {
    buffer.toString("utf-8");
    return true;
  } catch {
    return false;
  }
}