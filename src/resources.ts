/**
 * Resource management for Skillz MCP server
 */

import * as fs from "fs";
import * as path from "path";
import { Skill, SkillResourceMetadata } from "./types";
import { SkillRegistry } from "./registry";
import {
  readFileSync,
  readFileBytesSync,
  detectMimeType,
  encodeBase64,
  isValidUtf8,
  joinPath,
  getRelativePath,
  getAllFiles,
  SKILL_MARKDOWN,
} from "./utils";
import * as JSZip from "jszip";
import { parseSkillMd } from "./utils";

/**
 * Build a resource URI following MCP specification
 * Format: resource://skillz/{skill-slug}/{path}
 */
export function buildResourceUri(skill: Skill, relativePath: string): string {
  const encodedSlug = encodeURIComponent(skill.slug);
  const encodedPath = encodeURIComponent(relativePath).replace(/%2F/g, "/");
  return `resource://skillz/${encodedSlug}/${encodedPath}`;
}

/**
 * Get resource name (path without protocol)
 * Example: skillz/skill-name/path/to/file.ext
 */
export function getResourceName(skill: Skill, relativePath: string): string {
  return `${skill.slug}/${relativePath}`;
}

/**
 * Create an error resource response
 */
export function makeErrorResource(
  resourceUri: string,
  message: string
): SkillResourceMetadata & {
  content: string;
  encoding: string;
} {
  // Try to extract a name from the URI
  let name = "invalid resource";
  if (resourceUri.startsWith("resource://skillz/")) {
    try {
      const pathPart = resourceUri.slice("resource://skillz/".length);
      if (pathPart) {
        name = pathPart;
      }
    } catch {
      // Ignore
    }
  }

  return {
    uri: resourceUri,
    name,
    mimeType: "text/plain",
    content: `Error: ${message}`,
    encoding: "utf-8",
  };
}

/**
 * Fetch a resource by URI
 */
export async function fetchResource(
  registry: SkillRegistry,
  resourceUri: string
): Promise<
  SkillResourceMetadata & {
    content: string;
    encoding: string;
  }
> {
  // Validate URI prefix
  if (!resourceUri.startsWith("resource://skillz/")) {
    return makeErrorResource(
      resourceUri,
      "unsupported URI prefix. Expected resource://skillz/{skill-slug}/{path}"
    );
  }

  // Parse slug and path
  const remainder = resourceUri.slice("resource://skillz/".length);
  if (!remainder) {
    return makeErrorResource(resourceUri, "invalid resource URI format");
  }

  const parts = remainder.split("/");
  if (parts.length < 2 || !parts[0] || parts.slice(1).join("/") === "") {
    return makeErrorResource(resourceUri, "invalid resource URI format");
  }

  const slug = decodeURIComponent(parts[0]);
  const relPathStr = parts.slice(1).join("/");

  // Validate path doesn't traverse upward
  if (relPathStr.includes("..") || relPathStr.startsWith("/")) {
    return makeErrorResource(
      resourceUri,
      "invalid path: path traversal not allowed"
    );
  }

  // Lookup skill
  let skill: Skill;
  try {
    skill = registry.get(slug);
  } catch (error) {
    return makeErrorResource(resourceUri, `skill not found: ${slug}`);
  }

  // Read content based on skill type
  let data: Buffer;
  try {
    if (skill.zipPath) {
      // Zip-based skill
      const zipData = fs.readFileSync(skill.zipPath);
      const zip = await JSZip.loadAsync(zipData);

      const zipMemberPath = skill.zipRootPrefix
        ? skill.zipRootPrefix + relPathStr
        : relPathStr;

      const file = zip.files[zipMemberPath];
      if (!file || file.dir) {
        return makeErrorResource(
          resourceUri,
          `resource not found: ${relPathStr}`
        );
      }

      data = await file.async("nodebuffer");
    } else {
      // Directory-based skill
      const resourcePath = joinPath(skill.directory, relPathStr);

      // Security check: ensure the path is within the skill directory
      const resolvedResourcePath = path.resolve(resourcePath);
      const resolvedSkillDir = path.resolve(skill.directory);
      if (!resolvedResourcePath.startsWith(resolvedSkillDir)) {
        return makeErrorResource(
          resourceUri,
          "invalid path: path traversal not allowed"
        );
      }

      if (!fs.existsSync(resourcePath) || !fs.statSync(resourcePath).isFile()) {
        return makeErrorResource(
          resourceUri,
          `resource not found: ${relPathStr}`
        );
      }

      data = readFileBytesSync(resourcePath);
    }
  } catch (error) {
    return makeErrorResource(
      resourceUri,
      `failed to read resource: ${error}`
    );
  }

  // Detect MIME type
  const mimeType = detectMimeType(relPathStr);

  // Try to decode as UTF-8 text; if that fails, encode as base64
  let content: string;
  let encoding: string;

  if (isValidUtf8(data)) {
    content = data.toString("utf-8");
    encoding = "utf-8";
  } else {
    content = encodeBase64(data);
    encoding = "base64";
  }

  // Build resource name
  const name = getResourceName(skill, relPathStr);

  return {
    uri: resourceUri,
    name,
    mimeType,
    content,
    encoding,
  };
}

/**
 * Get all resource paths for a skill
 */
export async function getSkillResourcePaths(
  skill: Skill
): Promise<string[]> {
  const resources: string[] = [];

  if (skill.zipPath) {
    // Zip-based skill
    const zipData = fs.readFileSync(skill.zipPath);
    const zip = await JSZip.loadAsync(zipData);

    const files = Object.keys(zip.files).filter(
      (name) => !zip.files[name].dir
    );

    for (const name of files.sort()) {
      // Skip SKILL.md and macOS metadata
      if (name === SKILL_MARKDOWN || name.includes("__MACOSX/") || name.endsWith(".DS_Store")) {
        continue;
      }

      // Strip the root prefix if present
      let relPath: string;
      if (skill.zipRootPrefix && name.startsWith(skill.zipRootPrefix)) {
        relPath = name.slice(skill.zipRootPrefix.length);
      } else {
        relPath = name;
      }

      // Skip if it's still SKILL.md after stripping prefix
      if (relPath === SKILL_MARKDOWN) {
        continue;
      }

      resources.push(relPath);
    }
  } else {
    // Directory-based skill
    const allFiles = getAllFiles(skill.directory, (filePath) => {
      return filePath === skill.instructionsPath;
    });

    for (const filePath of allFiles) {
      const relPath = getRelativePath(skill.directory, filePath);
      resources.push(relPath);
    }
  }

  return resources.sort();
}

/**
 * Read skill instructions (SKILL.md body)
 */
export async function readSkillInstructions(skill: Skill): Promise<string> {
  let content: string;

  if (skill.zipPath) {
    // Zip-based skill
    const zipData = fs.readFileSync(skill.zipPath);
    const zip = await JSZip.loadAsync(zipData);

    const zipMemberPath = skill.zipRootPrefix
      ? skill.zipRootPrefix + SKILL_MARKDOWN
      : SKILL_MARKDOWN;

    const file = zip.files[zipMemberPath];
    if (!file || file.dir) {
      throw new Error(`SKILL.md not found in zip`);
    }

    content = await file.async("text");
  } else {
    // Directory-based skill
    content = readFileSync(skill.instructionsPath);
  }

  const { body } = parseSkillMd(content, skill.instructionsPath);
  return body;
}
