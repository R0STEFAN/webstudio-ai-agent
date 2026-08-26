# Webstudio AI Assistant Guide & Rules

## Project Architecture & Workflow
This repository contains the Webstudio visual web builder and an AI agent design workflow.

### AI Design & Cloud Sync Protocol:
1. **Local State Source of Truth:** All site pages, instances, and styles are stored in `.webstudio/data.json`.
2. **Assets:** All images and fonts reside in `.webstudio/assets/`.
3. **Execution Skill:** Always use the `webstudio-ai-designer` skill (`.agents/skills/webstudio-ai-designer/SKILL.md`) when creating or modifying Webstudio designs.
4. **Native MCP Tools (100% Local):** All 70+ official Webstudio MCP tools run locally via:
   ```bash
   webstudio mcp single-op-call <tool> --input-file <payload.json>
   # Setup once on fresh machines: node scripts/setup-local-mcp.mjs
   ```
5. **Cloud Push Highway:** To commit changes to Webstudio Cloud:
   ```bash
   webstudio import --to "<shareLink>"
   ```
6. **CLI Toolkit:** Pre-built scripts are available in `scripts/ai-designer/` (`engine.mjs` and `cli.mjs`).
