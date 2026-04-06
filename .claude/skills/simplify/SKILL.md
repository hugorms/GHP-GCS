---
name: simplify
description: Review changed or selected code for unnecessary complexity, duplication, or poor patterns, then refactor it. Use this skill when the user says "simplify this", "clean this up", or "refactor".
---

This skill reviews code for quality issues and simplifies it without changing behavior.

## When to Apply

- User says "simplify", "clean up", "refactor", "this is too complex"
- Code has obvious duplication, deeply nested logic, or over-engineered abstractions
- A function does too many things

## Principles

1. **Don't over-abstract**: three similar lines of code is better than a premature abstraction.
2. **Delete dead code**: if it's unused and not exported, remove it.
3. **Flatten nesting**: early returns reduce indent levels and improve readability.
4. **Inline obvious helpers**: a one-line helper used once is noise.
5. **Match existing style**: don't introduce new patterns that clash with the surrounding file.
6. **Don't add features**: simplification never adds new behavior.

## Steps

1. Read the code carefully.
2. Identify specific issues: duplication, unnecessary indirection, over-engineering, dead code.
3. Propose a simplified version.
4. Confirm behavior is identical (run tests if available).

## What NOT to do

- Don't add type annotations, docstrings, or comments to code you didn't change.
- Don't rename things just for style.
- Don't introduce new dependencies.
- Don't optimize prematurely — only simplify what's actually complex.
