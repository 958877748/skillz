import fs from "fs";
import path from "path";
import { FastMCP } from "fastmcp";

/**
 * Parse SKILL.md file to extract metadata
 * @param {string} content 
 * @returns {{name:string, description:string}} metadata
 */
export function parseSkillMd(content) {
  const lines = content.split('\n');
  const metadata = {};
  let inHeader = false;

  for (const line of lines) {
    if (line.trim() === '---') {
      inHeader = !inHeader;
      continue;
    }

    if (inHeader) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        metadata[key] = value;
      }
    }
  }

  return { metadata };
}

/**
 * Scan current directory for skills (non-recursive)
 */
export function scanCurrentDirectory() {
  /**
   * @type {{name:string, description:string}[]}
   */
  const skills = [];

  try {
    const entries = fs.readdirSync(process.cwd());

    for (const entry of entries) {
      const fullPath = path.join(process.cwd(), entry);

      // Check if it's a directory with SKILL.md
      if (fs.statSync(fullPath).isDirectory()) {
        const skillMdPath = path.join(fullPath, 'SKILL.md');
        if (fs.existsSync(skillMdPath)) {
          try {
            const content = fs.readFileSync(skillMdPath, 'utf8');
            const { metadata } = parseSkillMd(content);

            if (metadata.name && metadata.description) {
              skills.push({
                name: metadata.name,
                description: metadata.description
              });
            }
          } catch (error) {
            console.warn(`Error reading ${skillMdPath}: ${error.message}`);
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning directory: ${error.message}`);
  }

  return skills;
}


const server = new FastMCP({
  name: "Skillz MCP Server",
  version: "1.0.0"
});

server.addTool({
  name: "listSkill",
  description: "List all available skills in current directory with their names and descriptions",
  execute: async () => {
    const skills = scanCurrentDirectory();

    if (skills.length === 0) {
      return {
        content: [{
          type: "text",
          text: "No skills found in current directory."
        }]
      };
    }

    const result = skills.map(skill => ({
      name: skill.name,
      description: skill.description,
      url: `./${path.join(process.cwd(), skill.name)}`
    }));

    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    };
  }
});

server.start({
  transportType: "stdio",
});
console.log("Skillz MCP Server started");
