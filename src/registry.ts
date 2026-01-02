/**
 * Skill registry for discovering and managing skills
 */

import * as fs from "fs";
import * as path from "path";
import * as JSZip from "jszip";
import {
  Skill,
  SkillMetadata,
  SkillValidationError,
  SkillError,
} from "./types";
import {
  parseSkillMd,
  slugify,
  SKILL_MARKDOWN,
  readFileSync,
  existsSync,
  isDirectory,
  isFile,
  getAllFiles,
  getRelativePath,
  joinPath,
  isZipFile,
  resolveHome,
} from "./utils";

export class SkillRegistry {
  private root: string;
  private skillsBySlug: Map<string, Skill> = new Map();
  private skillsByName: Map<string, Skill> = new Map();

  constructor(root: string) {
    this.root = resolveHome(root);
  }

  /**
   * Get all loaded skills
   */
  public get skills(): Skill[] {
    return Array.from(this.skillsBySlug.values());
  }

  /**
   * Load all skills from the root directory
   */
  public async load(): Promise<void> {
    if (!existsSync(this.root) || !isDirectory(this.root)) {
      throw new SkillError(
        `Skills root ${this.root} does not exist or is not a directory.`
      );
    }

    console.log(`Discovering skills in ${this.root}`);
    this.skillsBySlug.clear();
    this.skillsByName.clear();

    const rootPath = path.resolve(this.root);
    await this.scanDirectory(rootPath);

    console.log(`Loaded ${this.skillsBySlug.size} skills`);
  }

  /**
   * Recursively scan directory for skills
   */
  private async scanDirectory(directory: string): Promise<void> {
    // If this directory has SKILL.md, treat it as a dir-based skill
    const skillMdPath = joinPath(directory, SKILL_MARKDOWN);
    if (existsSync(skillMdPath) && isFile(skillMdPath)) {
      await this.registerDirSkill(directory, skillMdPath);
      return; // Don't recurse into skill directories
    }

    // Otherwise, look for zip files and subdirectories
    let entries: string[];
    try {
      entries = fs.readdirSync(directory);
    } catch (error) {
      console.warn(`Cannot read directory ${directory}: ${error}`);
      return;
    }

    // First, recurse into subdirectories (to find directory skills first)
    // This ensures directory skills take precedence over zip skills
    for (const entry of entries.sort()) {
      const fullPath = joinPath(directory, entry);
      if (isDirectory(fullPath)) {
        await this.scanDirectory(fullPath);
      }
    }

    // Then check for zip files in this directory
    for (const entry of entries.sort()) {
      const fullPath = joinPath(directory, entry);
      if (existsSync(fullPath) && isFile(fullPath) && isZipFile(fullPath)) {
        await this.tryRegisterZipSkill(fullPath);
      }
    }
  }

  /**
   * Register a directory-based skill
   */
  private async registerDirSkill(
    directory: string,
    skillMdPath: string
  ): Promise<void> {
    try {
      const content = readFileSync(skillMdPath);
      const { metadata } = parseSkillMd(content, skillMdPath);

      const slug = slugify(metadata.name);
      if (this.skillsBySlug.has(slug)) {
        console.error(
          `Duplicate skill slug '${slug}'; skipping ${directory}`
        );
        return;
      }

      if (this.skillsByName.has(metadata.name)) {
        console.warn(
          `Duplicate skill name '${metadata.name}' found in ${directory}; only first occurrence is kept`
        );
        return;
      }

      const resources = this.collectResources(directory);

      const skill: Skill = {
        slug,
        directory: path.resolve(directory),
        instructionsPath: path.resolve(skillMdPath),
        metadata,
        resources,
      };

      if (path.basename(directory) !== slug) {
        console.debug(
          `Skill directory name '${path.basename(
            directory
          )}' does not match slug '${slug}'`
        );
      }

      this.skillsBySlug.set(slug, skill);
      this.skillsByName.set(metadata.name, skill);
    } catch (error) {
      console.warn(`Skipping invalid skill at ${directory}: ${error}`);
    }
  }

  /**
   * Try to register a zip file as a skill
   */
  private async tryRegisterZipSkill(zipPath: string): Promise<void> {
    try {
      const zipData = fs.readFileSync(zipPath);
      const zip = await JSZip.loadAsync(zipData);

      // Check if SKILL.md exists at root or in single top-level dir
      let skillMdPath: string | null = null;
      let zipRootPrefix = "";

      const files = Object.keys(zip.files).filter(
        (name) => !zip.files[name].dir
      );

      // First, try SKILL.md at root
      if (files.includes(SKILL_MARKDOWN)) {
        skillMdPath = SKILL_MARKDOWN;
      } else {
        // Try to find SKILL.md in single top-level directory
        const topLevelDirs = new Set<string>();
        for (const name of Object.keys(zip.files)) {
          if (name.includes("/")) {
            const topDir = name.split("/")[0];
            topLevelDirs.add(topDir);
          }
        }

        // If there's exactly one top-level directory
        if (topLevelDirs.size === 1) {
          const topDir = Array.from(topLevelDirs)[0];
          const candidate = `${topDir}/${SKILL_MARKDOWN}`;
          if (files.includes(candidate)) {
            skillMdPath = candidate;
            zipRootPrefix = `${topDir}/`;
          }
        }
      }

      if (!skillMdPath) {
        console.debug(
          `Zip ${zipPath} missing SKILL.md at root or in single top-level directory; skipping`
        );
        return;
      }

      // Parse SKILL.md from zip
      const skillMdFile = zip.files[skillMdPath];
      const skillMdText = await skillMdFile.async("text");

      // Parse metadata
      const { metadata } = parseSkillMd(skillMdText, skillMdPath);

      // Use zip stem as slug
      const slug = slugify(metadata.name);
      if (this.skillsBySlug.has(slug)) {
        console.warn(
          `Duplicate skill slug '${slug}'; skipping zip ${zipPath}`
        );
        return;
      }

      if (this.skillsByName.has(metadata.name)) {
        console.warn(
          `Duplicate skill name '${metadata.name}' found in zip ${zipPath}; skipping`
        );
        return;
      }

      // Create skill with zipPath set
      const skill: Skill = {
        slug,
        directory: path.resolve(path.dirname(zipPath)),
        instructionsPath: path.resolve(zipPath),
        metadata,
        resources: [], // Will be populated on-demand
        zipPath: path.resolve(zipPath),
        zipRootPrefix,
      };

      this.skillsBySlug.set(slug, skill);
      this.skillsByName.set(metadata.name, skill);
      console.debug(
        `Registered zip-based skill '${slug}' from ${zipPath} (root_prefix='${zipRootPrefix}')`
      );
    } catch (error) {
      console.warn(`Cannot read zip file ${zipPath}: ${error}`);
    }
  }

  /**
   * Collect all files in skill directory except SKILL.md
   */
  private collectResources(directory: string): string[] {
    const skillMdPath = joinPath(directory, SKILL_MARKDOWN);
    const files = getAllFiles(directory, (filePath) => filePath === skillMdPath);
    return files;
  }

  /**
   * Get a skill by slug
   */
  public get(slug: string): Skill {
    const skill = this.skillsBySlug.get(slug);
    if (!skill) {
      throw new SkillError(`Unknown skill '${slug}'`);
    }
    return skill;
  }

  /**
   * Check if a skill exists
   */
  public has(slug: string): boolean {
    return this.skillsBySlug.has(slug);
  }
}
