# Webstudio AI Assistant Guide & Rules

## Project Architecture & Workflow
This repository contains the Webstudio visual web builder and an AI agent design workflow.

### AI Design & Cloud Sync Protocol:
1. **Local State Source of Truth:** All site pages, instances, and styles are stored in `.webstudio/data.json`.
2. **Assets:** All images and fonts reside in `.webstudio/assets/`.
3. **Design Token First (DRY Styles):** NEVER duplicate styles across repeating elements (buttons, cards, badges, headings). Always declare and attach reusable Design Tokens using `ws:tokens={[token('token-<name>', css`...`)]}`.
4. **Execution Skill:** Always use the `webstudio-ai-designer` skill (`.agents/skills/webstudio-ai-designer/SKILL.md`) when creating or modifying Webstudio designs.
5. **Native MCP Tools (100% Local):** All 70+ official Webstudio MCP tools run locally via:
   ```bash
   npx webstudio mcp single-op-call <tool> --input-file <payload.json>
   # Setup once per project: npm i webstudio && node scripts/setup-local-mcp.mjs --local
   ```
6. **Asset Upload & Cloud Sync Protocol:**
   - When generating new local images in `.webstudio/assets/`, run:
     ```bash
     npm run upload-assets
     ```
     This automatically uploads images via the session cookie in `.webstudio/session.json`, remaps all image `src` props in `data.build.props`, and syncs with Webstudio Cloud.
   - To manually push project structure to Webstudio Cloud:
     ```bash
     npx webstudio import --to "<shareLink>"
     ```
7. **CLI Toolkit:** Pre-built scripts are available in `scripts/ai-designer/` (`engine.mjs` and `cli.mjs`) and `scripts/upload-assets.mjs`.
