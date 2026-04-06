---
name: web-app-testing
description: Test web applications end-to-end using Playwright, Vitest, or Jest. Use this skill when the user asks to write tests, set up a testing framework, debug failing tests, or improve test coverage for a web application.
---

This skill guides writing and running tests for web applications. It covers unit tests, integration tests, and end-to-end (E2E) tests.

## When to Apply

- User asks to "write tests", "add tests", "test this component/page/API"
- User wants to set up a testing framework from scratch
- Tests are failing and the user wants help debugging
- User wants to improve test coverage

## Testing Frameworks (by context)

- **Playwright** — E2E browser tests (preferred for full-page interaction flows)
- **Vitest** — Unit and component tests in Vite-based projects (React, Vue, etc.)
- **Jest** — Unit tests in non-Vite projects (Next.js, CRA)
- **React Testing Library** — Component-level tests with DOM assertions

## Approach

1. **Identify what to test**: behavior, not implementation. Test what the user sees, not internal state.
2. **Choose the right tool**: E2E with Playwright for user flows; Vitest/Jest for logic and components.
3. **Write minimal, focused tests**: one assertion per test where possible; descriptive test names.
4. **Run and confirm tests pass** before finishing.

## Plane-specific notes

This project (Plane) uses:

- `apps/web` — Next.js frontend
- `apps/api` — Django REST API backend
- Check `package.json` in `apps/web` for existing test scripts before adding new tooling.

## Example patterns

```ts
// Playwright E2E
test("user can create an issue", async ({ page }) => {
  await page.goto("/");
  await page.click('[data-testid="create-issue"]');
  await page.fill('[placeholder="Issue title"]', "My test issue");
  await page.click('button[type="submit"]');
  await expect(page.locator("text=My test issue")).toBeVisible();
});
```

```ts
// Vitest component test
import { render, screen } from '@testing-library/react';
import { IssueCard } from './IssueCard';

test('renders issue title', () => {
  render(<IssueCard title="Test issue" />);
  expect(screen.getByText('Test issue')).toBeInTheDocument();
});
```
