---
name: skill-creator
description: Create new Claude Code skills (SKILL.md files) and plugins. Use this skill when the user wants to build a new skill, automate a workflow, or package reusable instructions for Claude Code.
---

This skill guides creation of new Claude Code skills and plugins.

## When to Apply

- User says "create a skill", "build a plugin", "add a slash command"
- User wants to automate a repeated workflow in Claude Code
- User wants to package instructions for others to reuse

## Skill vs Plugin

- **Skill (SKILL.md)** — a single markdown file with instructions Claude follows when a trigger is matched. Best for simple, focused behaviors.
- **Plugin** — a directory with skills, commands, agents, and/or hooks. Best for multi-feature toolkits.

## Creating a Skill

1. Create `SKILL.md` in `.claude/skills/<skill-name>/SKILL.md` (project-scoped) or `~/.claude/skills/<skill-name>/SKILL.md` (global).
2. Add frontmatter:
   ```yaml
   ---
   name: skill-name
   description: One-line description used for trigger matching. Include key verbs and nouns that describe when to use this skill.
   ---
   ```
3. Write the body: instructions Claude will follow when the skill is triggered.

## SKILL.md Best Practices

- **Trigger description**: be specific. Bad: "helps with code". Good: "Refactor a React component to use hooks when the user asks to convert class components."
- **Include when-to-apply criteria** so the skill activates at the right time.
- **Progressive disclosure**: short overview, then detailed sections. Don't pad with filler.
- **Working examples**: concrete examples are more useful than abstract rules.
- **No boilerplate**: don't repeat generic advice Claude already knows.

## Creating a Full Plugin

Use the `plugin-dev` plugin (installed) for comprehensive guidance on:

- Plugin manifest (`manifest.json`)
- Slash commands with frontmatter
- Hooks (pre/post tool events)
- Agent definitions
- Marketplace publishing

## Quick plugin structure

```
my-plugin/
  manifest.json
  skills/
    my-skill/
      SKILL.md
  commands/
    my-command.md
```
