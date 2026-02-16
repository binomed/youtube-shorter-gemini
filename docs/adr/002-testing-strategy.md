# Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
# Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

# ADR 002: Testing Strategy

**Date:** 2026-02-11  
**Status:** Accepted  
**Context:** Story 0.2 - Quality Gates & Testing Setup

## Decision

We have adopted a comprehensive testing strategy across the monorepo to ensure code quality and accessibility compliance from the start.

## Testing Framework Choices

### Backend (apps/back)
- **Framework:** Jest 30.0.0
- **Rationale:** NestJS default, excellent TypeScript support, mature ecosystem
- **Coverage:** Unit and integration tests with built-in coverage reporting

### Frontend (apps/front)
- **Framework:** Vitest 4.x  
- **Rationale:** Vite-native, extremely fast, Jest-compatible API, modern ES modules support
- **Testing Utilities:** @open-wc/testing-helpers for Lit component testing
- **Environment:** happy-dom for lightweight DOM simulation

#### Why happy-dom over jsdom?

**Performance:** happy-dom is 2-3x faster than jsdom (~3-5s vs ~8-12s for 1000 tests), critical for CI/CD efficiency.

**Vitest Integration:** happy-dom is the recommended environment for Vitest, optimized for better tree-shaking and lower overhead.

**Memory Footprint:** ~500KB bundle size vs ~2.5MB for jsdom, using ~20-30MB RAM vs ~50-80MB. Significant for parallel monorepo tests.

**Sufficient for Unit Tests:** Provides complete DOM API, Custom Elements, Shadow DOM, Events, and CSS selectors - everything needed for Lit component testing.

**Limitations (acceptable):** Missing advanced navigation APIs and Canvas rendering, but these aren't needed for unit tests. For complex scenarios requiring full browser APIs, we use Playwright in E2E tests.

**Fallback:** Switching to jsdom requires only one line change in `vitest.config.ts` if specific jsdom features are needed.

### Shared Package (packages/shared)
- **Framework:** Jest
- **Rationale:** Consistency with backend, simple setup for utility testing

## Accessibility Testing

- **Tool:** @axe-core/playwright
- **Standard:** WCAG 2.1 AA compliance
- **Approach:** Basic accessibility checks in unit tests, comprehensive audits via CI/CD
- **Note:** Full axe-core testing requires browser environment (Playwright/Puppeteer in E2E tests)

## CI/CD Integration

- **Platform:** GitHub Actions
- **Workflow:** `.github/workflows/ci.yml`
- **Jobs:**
  1. **Lint and Test:** Runs on every push/PR, executes all tests across monorepo
  2. **Coverage:** Generates coverage reports for backend and frontend
  3. **Accessibility Audit:** Dedicated job for A11y validation

## Test Co-location Pattern

Following architecture requirements:
- Test files co-located with source: `*.spec.ts` next to implementation
- Backend integration tests in `apps/back/test/` directory
- Frontend accessibility tests in `apps/front/test/` directory

## Coverage Targets

- **Minimum:** 80% coverage for core business logic
- **Reports:** JSON and HTML formats, uploaded as GitHub Actions artifacts
- **Commands:**
  - Backend: `npm run test:cov --workspace=back`
  - Frontend: `npm run test:coverage --workspace=front`

## Consequences

### Positive
- ✅ Automated quality gates prevent regressions
- ✅ Accessibility compliance enforced from day one
- ✅ Fast feedback loop with Vitest (frontend)
- ✅ Comprehensive coverage reporting
- ✅ CI/CD pipeline catches issues early

### Negative
- ⚠️ Additional build time for test execution in CI
- ⚠️ Maintenance overhead for test infrastructure

### Neutral
- 📝 Developers must write tests for all new features
- 📝 Different frameworks for backend/frontend (necessary tradeoff for optimal DX)

## Implementation Details

- All tests include Apache 2.0 license headers
- TypeScript strict typing enforced in tests
- Test scripts available via `npm run test` at root (Turbo orchestration)
- Coverage reports retained for 30 days in CI

## References

- [Architecture Decisions](../planning-artifacts/architecture.md)
- [Story 0.2: Quality Gates & Testing Setup](../implementation-artifacts/0-2-quality-gates-testing-setup.md)
- [Testing Strategy Skill](.agent/skills/testing_strategy/SKILL.md)
