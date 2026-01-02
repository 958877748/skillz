/**
 * MCP server builder for Skillz
 */

import { FastMCP } from "fastmcp";
import { z } from "zod";
import { SkillRegistry } from "./registry";
import {
  fetchResource,
  getSkillResourcePaths,
  readSkillInstructions,
  buildResourceUri,
  getResourceName,
  makeErrorResource,
} from "./resources";
import { Skill, SkillResourceMetadata } from "./types";

const SERVER_NAME = "Skillz MCP Server";

/**
 * Format tool description for skill
 */
function formatToolDescription(skill: Skill): string {
  return `[SKILL] ${skill.metadata.description} - Invoke this to receive specialized instructions and resources for this task.`;
}

/**
 * Build and configure the MCP server
 */
export async function buildServer(
  registry: SkillRegistry,
  version: string
): Promise<FastMCP> {
  const skillNames = registry.skills.map((s) => s.metadata.name).join(", ") ||
    "No skills";
  const skillCount = registry.skills.length;

  // Create FastMCP server with instructions
  const server = new FastMCP({
    name: SERVER_NAME,
    version: version as `${number}.${number}.${number}`,
  });

  // Server instructions are added as a system prompt or resource in the response

  // Register fetch_resource tool for clients without MCP resource support
  server.addTool({
    name: "fetch_resource",
    description:
      "[FALLBACK ONLY] Fetch a skill resource by URI. IMPORTANT: Only use this if your client does NOT support native MCP resource fetching. If your client supports MCP resources, use the native resource fetching mechanism instead. This tool only supports URIs in the format: resource://skillz/{skill-slug}/{path}. Resource URIs are provided in skill tool responses under the 'resources' field.",
    parameters: z.object({
      resource_uri: z
        .string()
        .describe("The resource URI to fetch (e.g., resource://skillz/skill-name/file.txt)"),
    }),
    execute: async ({ resource_uri }) => {
      const result = await fetchResource(registry, resource_uri);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  });

  // Register each skill as a tool
  for (const skill of registry.skills) {
    await registerSkill(server, skill);
  }

  return server;
}

/**
 * Register a skill as an MCP tool
 */
async function registerSkill(server: FastMCP, skill: Skill): Promise<void> {
  // Get resource paths for the skill response
  const resourcePaths = await getSkillResourcePaths(skill);

  // Register the skill tool
  server.addTool({
    name: skill.slug,
    description: formatToolDescription(skill),
    parameters: z.object({
      task: z
        .string()
        .describe("The specific task you want to accomplish using this skill"),
    }),
    execute: async ({ task }) => {
      // Read instructions
      const instructions = await readSkillInstructions(skill);

      // Build resource metadata
      const resourceMetadata: SkillResourceMetadata[] = [];
      for (const resourcePath of resourcePaths) {
        resourceMetadata.push({
          uri: buildResourceUri(skill, resourcePath),
          name: getResourceName(skill, resourcePath),
          mimeType: undefined,
        });
      }

      // Format response
      const response = {
        skill: skill.slug,
        task,
        metadata: {
          name: skill.metadata.name,
          description: skill.metadata.description,
          license: skill.metadata.license,
          allowed_tools: skill.metadata.allowedTools,
          extra: skill.metadata.extra,
        },
        resources: resourceMetadata,
        instructions,
        usage: `HOW TO USE THIS SKILL:

1. READ the instructions carefully - they contain specialized guidance for completing the task.

2. UNDERSTAND the context:
   - The 'task' field contains the specific request
   - The 'metadata.allowed_tools' list specifies which tools to use when applying this skill (if specified, respect these constraints)
   - The 'resources' array lists additional files

3. APPLY the skill instructions to complete the task:
   - Instructions are authored by skill creators and may contain domain-specific expertise, best practices, or specialized techniques

4. ACCESS resources when needed:
   - If instructions reference additional files or you need them, retrieve from the MCP server
   - PREFERRED: Use native MCP resource fetching if your client supports it (use URIs from 'resources' field)
   - FALLBACK: If your client lacks MCP resource support, call the fetch_resource tool with the URI. Example:
     fetch_resource(resource_uri="resource://skillz/...")

5. RESPECT constraints:
   - If 'metadata.allowed_tools' is specified and non-empty, prefer using only those tools when executing the skill instructions
   - This helps ensure the skill works as intended

Remember: Skills are specialized instruction sets created by experts. They provide domain knowledge and best practices you can apply to user tasks.`,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    },
  });
}

/**
 * List all discovered skills
 */
export function listSkills(registry: SkillRegistry): string {
  if (registry.skills.length === 0) {
    return "No valid skills discovered.";
  }

  return registry.skills
    .map(
      (skill) =>
        `- ${skill.metadata.name} (slug: ${skill.slug}) -> ${skill.directory}`
    )
    .join("\n");
}
