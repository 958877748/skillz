# Skillz

## 👌 **Use _skills_ in any agent** _(Codex, Copilot, Cursor, etc...)_

[![npm version](https://img.shields.io/npm/v/skillz.svg)](https://www.npmjs.com/package/skillz)
[![npm downloads](https://img.shields.io/npm/dm/skillz.svg)](https://www.npmjs.com/package/skillz)

> ⚠️ **Experimental proof‑of‑concept. Potentially unsafe. Treat skills like untrusted code and run in sandboxes/containers. Use at your own risk.**

**Skillz** is an MCP server that turns [Claude-style skills](https://github.com/anthropics/skills) _(`SKILL.md` plus optional resources)_ into callable tools for any MCP client. It discovers each skill, exposes the authored instructions and resources, and can run bundled helper scripts.

> 💡 You can find skills to install at the **[Skills Supermarket](http://skills.intellectronica.net/)** directory.

## Quick Start

To run the MCP server in your agent, use the following config (or equivalent):

```json
{
  "skillz": {
    "command": "npx",
    "args": ["skillz@latest"]
  }
}
```

with the skills residing at `./.skillz` (in your project directory)

_or_

```json
{
  "skillz": {
    "command": "npx",
    "args": ["skillz@latest", "/path/to/skills/directory"]
  }
}
```

or Docker

You can run Skillz using Docker for isolation. The image is available on Docker Hub at `intellectronica/skillz`.

To run the Skillz MCP server with your project directory mounted using Docker, configure your agent as follows:

```json
{
  "skillz": {
    "command": "docker",
    "args": [
      "run",
      "-i",
      "--rm",
      "-v",
      "${workspaceFolder}:/workspace",
      "intellectronica/skillz",
      "/workspace/.skillz"
    ]
  }
}
```

This mounts your project directory and uses the `.skillz` subdirectory within it.

## Gemini CLI Extension

A Gemini CLI extension is available at [intellectronica/gemini-cli-skillz](https://github.com/intellectronica/gemini-cli-skillz).

Install it with:

```bash
gemini extensions install https://github.com/intellectronica/gemini-cli-skillz
```

This extension enables Anthropic-style Agent Skills in Gemini CLI using the skillz MCP server.

## Installation

```bash
npm install -g skillz
```

Or using npx:

```bash
npx skillz
```

## Usage

Skillz looks for skills inside the root directory you provide (defaults to
`./.skillz` in your current project). Each skill lives in its own folder or zip archive (`.zip` or `.skill`)
that includes a `SKILL.md` file with YAML front matter describing the skill. Any
other files in the skill become downloadable resources for your agent (scripts,
datasets, examples, etc.).

### Project Structure

We recommend managing skills as part of your project using git submodules:

```bash
# Add a skills repository as a submodule
git submodule add https://github.com/your-org/project-skills .skillz
git submodule update --init --recursive
```

An example project directory might look like this:

```text
my-project/
├── .skillz/                    # Skills directory (git submodule)
│   ├── summarize-docs/
│   │   ├── SKILL.md
│   │   ├── summarize.py
│   │   └── prompts/example.txt
│   ├── translate.zip
│   ├── analyzer.skill
│   └── web-search/
│       └── SKILL.md
├── src/
├── package.json
└── README.md
```

This approach ensures that:
- Skills are version-controlled with your project
- Team members get the same skills when they clone the repository
- Different projects can have different skill sets
- Skills are easily shareable and reproducible

When packaging skills as zip archives (`.zip` or `.skill`), include the `SKILL.md`
either at the root of the archive or inside a single top-level directory:

```text
translate.zip
├── SKILL.md
└── helpers/
    └── translate.js
```

```text
data-cleaner.zip
└── data-cleaner/
    ├── SKILL.md
    └── clean.py
```

### Directory Structure: Skillz vs Claude Code

Skillz supports a more flexible skills directory than Claude Code. In addition to a flat layout, you can organize skills in nested subdirectories and include skills packaged as `.zip` or `.skill` files (as shown in the examples above).

Claude Code, on the other hand, expects a flat skills directory: every immediate subdirectory is a single skill. Nested directories are not discovered, and `.zip` or `.skill` files are not supported.

If you want your skills directory to be compatible with Claude Code (for example, so you can symlink one skills directory between the two tools), you must use the flat layout.

**Claude Code–compatible layout:**

```text
skills/
├── hello-world/
│   ├── SKILL.md
│   └── run.sh
└── summarize-text/
    ├── SKILL.md
    └── run.py
```

**Skillz-only layout examples** (not compatible with Claude Code):

```text
skills/
├── text-tools/
│   └── summarize-text/
│       ├── SKILL.md
│       └── run.py
├── image-processing.zip
└── data-analyzer.skill
```

You can use `skillz --list-skills` (optionally pointing at another skills root)
to verify which skills the server will expose before connecting it to your
agent.

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev

# Run tests
npm test

# Lint the code
npm run lint

# Format the code
npm run format
```

## CLI Reference

`skillz [skills_root] [options]`

| Flag / Option | Description |
| --- | --- |
| positional `skills_root` | Optional skills directory (defaults to `./.skillz` in current project). |
| `--transport {stdio,http,sse}` | Choose the FastMCP transport (default `stdio`). |
| `--host HOST` | Bind address for HTTP/SSE transports. |
| `--port PORT` | Port for HTTP/SSE transports. |
| `--path PATH` | URL path when using the HTTP transport. |
| `--list-skills` | List discovered skills and exit. |
| `--verbose` | Emit debug logging to the console. |
| `--log` | Mirror verbose logs to `/tmp/skillz.log`. |

## Git Submodule Workflow

Here's a recommended workflow for managing skills with git submodules:

```bash
# 1. Create a central skills repository (if you don't have one)
git init my-project-skills
cd my-project-skills
mkdir summarize-docs translate-text
# ... add SKILL.md files to each skill directory ...
git add . && git commit -m "Initial skills"
git remote add origin https://github.com/your-org/my-project-skills.git
git push -u origin main

# 2. Add skills as a submodule to your project
cd my-project
git submodule add https://github.com/your-org/my-project-skills.git .skillz
git submodule update --init --recursive

# 3. Commit the submodule reference
git add .skillz .gitmodules
git commit -m "Add skills submodule"

# 4. Update skills later
cd .skillz
git pull origin main
cd ..
git add .skillz
git commit -m "Update skills to latest version"
```

---

> Made with 🫶 by [`@intellectronica`](https://intellectronica.net)
