# Story 0.2: quality-gates-testing-setup

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Developer,
I want automated Jest/Vitest testing and Axe-core accessibility auditing,
So that I can maintain high quality and accessibility from the start.

## Acceptance Criteria

1. **Given** the monorepo structure **When** I commit code **Then** automated tests (Unit & Integration) run.
2. **And** an accessibility audit (CI) checks the Lit components.
3. Unit tests run successfully for `apps/back` using Jest.
4. Unit tests run successfully for `apps/front` using Vitest.
5. Integration tests are configured for `apps/back`.
6. Axe-core accessibility testing is integrated for Lit components in `apps/front`.
7. CI/CD pipeline (e.g., GitHub Actions) is configured to run tests and accessibility audits automatically.
8. Test coverage reports are generated for both backend and frontend.
9. All tests pass successfully in the initial setup.

## Tasks / Subtasks

- [x] Backend Testing Setup (AC: 1, 3, 5, 8)
  - [x] Verify Jest configuration in `apps/back/package.json` (already initialized from NestJS CLI)
  - [x] Create sample unit test for existing service/controller
  - [x] Configure Jest coverage reporting
  - [x] Add integration test setup with NestJS testing utilities
  - [x] Create sample integration test (e.g., app.controller integration test)
- [x] Frontend Testing Setup (AC: 1, 4, 6, 8)
  - [x] Install and configure Vitest for `apps/front`
  - [x] Create Vitest config file (`vitest.config.ts`)
  - [x] Create sample unit test for existing Lit component
  - [x] Install `@axe-core/playwright` or `axe-core` for accessibility testing
  - [x] Create accessibility test suite for Lit components
  - [x] Configure coverage reporting for Vitest
- [x] Shared Package Testing (AC: 1, 8)
  - [x] Verify Jest configuration is working (already added in code review fixes)
  - [x] Add additional tests for shared utilities if needed
- [x] CI/CD Pipeline Setup (AC: 2, 7)
  - [x] Create `.github/workflows/ci.yml` for GitHub Actions
  - [x] Configure workflow to run on `push` and `pull_request` events
  - [x] Add job to install dependencies (`npm ci`)
  - [x] Add job to run lint (`npm run lint`)
  - [x] Add job to run all tests (`npm run test`)
  - [x] Add job to generate and upload coverage reports
  - [x] Add accessibility audit job for frontend components
- [x] Documentation & Verification (AC: 9)
  - [x] Update CONTRIBUTING.md with testing guidelines
  - [x] Add README section on running tests locally
  - [x] Verify all tests pass locally before commit
  - [x] Create ADR for testing strategy (ADR 002)

## Dev Notes

### Architecture Compliance

- **Testing Standards:** Architecture requires "tests unitaires (classes)" and co-located test files (`*.spec.ts`) [Source: architecture.md#Technical Constraints]
- **Naming:** Test files follow `*.spec.ts` pattern, co-located with source files [Source: architecture.md#Structure Patterns]
- **Test Frameworks:** Jest for backend (NestJS), Vitest for frontend (Lit/Vite) [Source: architecture.md#Testing Framework, line 234]
- **Accessibility:** WCAG 2.1 AA compliance is mandatory [Source: architecture.md#Technical Constraints, line 118]
- **License Headers:** All test files must include Apache 2.0 headers [Source: architecture.md#Process Patterns, line 55]

### Tech Stack

- **Backend Testing:** Jest 30.0.0 (already configured in apps/back/package.json)
- **Frontend Testing:** Vitest (needs to be added)
- **Accessibility Testing:** @axe-core/playwright or axe-core + jsdom
- **CI/CD:** GitHub Actions
- **Coverage:** Built-in Jest/Vitest coverage reporters

### Previous Story Intelligence

From **Story 0.1 (monorepo-scaffolding)**:
- Jest is already configured in `apps/back/package.json` with test scripts
- Shared package has Jest configured with basic test (`packages/shared/test/index.spec.ts`)
- ESLint rules are stricter now (`explicit-function-return-type`: warn, `no-explicit-any`: error)
- All source files have Apache 2.0 license headers
- Turbo is set up to run tasks across packages via `turbo run test`
- Test script pattern: `npm run test` at root delegates to turbo

**Key Learnings:**
- Turbo orchestration works: can run `npm run test` at root
- Package structure is clean: apps/back, apps/front, packages/shared all independent
- NestJS CLI already set up Jest with proper config - don't reinvent
- Tailwind CSS 4.x and Shoelace are integrated in frontend

### Git Intelligence Summary

Recent commits show:
1. Latest: Code review fixes including Jest setup for shared package
2. Previous: Monorepo scaffolding with NestJS and Lit
3. Skills were added for Testing, Accessibility, Performance, etc.

**Patterns Established:**
- Conventional Commits enforced (`feat:`, `fix:`)
- Apache 2.0 license required in all files
- Test co-location strategy (tests next to source files)

### Testing Requirements Specification

**Backend (NestJS + Jest):**
- Unit tests for services, controllers, and utilities
- Integration tests using NestJS TestingModule
- Coverage target: >80% for critical business logic
- Test files: `*.spec.ts` co-located with source
- Command: `npm run test` (already configured)

**Frontend (Lit + Vitest):**
- Unit tests for Lit components using Vitest
- Test component rendering, props, events
- Accessibility tests using axe-core
- Coverage target: >80% for components
- Test files: `*.spec.ts` co-located in `src/components/`
- Command: `npm run test` (needs to be added)

**Shared Package (Jest):**
- Unit tests for DTOs, types, validation schemas
- Already has basic setup from code review
- Command: `npm run test` (already configured)

**CI/CD Requirements:**
- Run on every push and PR
- Fail build if tests fail
- Fail build if accessibility audit fails
- Generate coverage reports
- Upload coverage to artifact storage (optional: Codecov)

### Accessibility Testing Approach

**Tools:**
- `@axe-core/playwright` for comprehensive A11y testing
- OR `axe-core` + `jsdom` for Lit component testing

**Test Categories:**
- Color contrast (WCAG AA)
- Keyboard navigation
- ARIA attributes
- Screen reader compatibility
- Focus management

**Testing Pattern:**
```typescript
import { injectAxe, checkA11y } from 'axe-playwright';
// Test each Lit component for A11y violations
```

### File Structure Requirements

```
apps/back/
├── src/
│   ├── app.controller.spec.ts (unit test)
│   ├── app.service.spec.ts (unit test)
│   └── main.ts
├── test/
│   ├── app.e2e-spec.ts (integration test - already exists)
│   └── jest-e2e.json
└── package.json (Jest already configured)

apps/front/
├── src/
│   ├── components/
│   │   └── my-element.spec.ts (NEW - unit test)
│   ├── my-element.ts
│   └── index.css
├── vitest.config.ts (NEW)
├── test/
│   └── accessibility.spec.ts (NEW - A11y tests)
└── package.json (needs Vitest scripts)

.github/
└── workflows/
    └── ci.yml (NEW - CI/CD pipeline)

docs/adr/
└── 002-testing-strategy.md (NEW)
```

### Latest Technical Information

**Vitest** (Latest stable: v2.1.8 as of Feb 2026):
- Vite-native testing framework
- Extremely fast with ES modules support
- Compatible with Jest API
- Built-in coverage via c8
- Installation: `npm install -D vitest @vitest/ui`

**Axe-core** (Latest: v4.10.2):
- Industry standard for accessibility testing
- WCAG 2.0, 2.1, 2.2 support
- Integration: `@axe-core/playwright` for comprehensive testing
- Alternative: `axe-core` + `jsdom` for unit testing

**GitHub Actions:**
- Use `actions/checkout@v4` for repo checkout
- Use `actions/setup-node@v4` for Node.js setup
- Cache dependencies with `actions/cache@v4`
- Standard workflow for Node.js monorepos

### Project Structure Notes

-  Co-locate tests next to source files (architecture requirement)
- Use Turbo to run tests across all packages
- Separate unit tests (inline) from integration tests (`test/` folder for backend)
- Frontend accessibility tests in dedicated `test/` folder

### References

- [PRD](file:///Users/jeanfrancoisgarreau/Projets/youtube-shorter-gemini/_bmad-output/planning-artifacts/prd.md)
- [Architecture Decisions](file:///Users/jeanfrancoisgarreau/Projets/youtube-shorter-gemini/_bmad-output/planning-artifacts/architecture.md)
- [Epics - Story 0.2](file:///Users/jeanfrancoisgarreau/Projets/youtube-shorter-gemini/_bmad-output/planning-artifacts/epics.md#L124-L134)
- [Previous Story 0.1](file:///Users/jeanfrancoisgarreau/Projets/youtube-shorter-gemini/_bmad-output/implementation-artifacts/0-1-monorepo-scaffolding.md)
- [Testing Strategy Skill](file:///Users/jeanfrancoisgarreau/Projets/youtube-shorter-gemini/.agent/skills/testing_strategy/SKILL.md)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- Backend testing: Jest already configured, unit test (app.controller.spec.ts) and integration test (app.e2e-spec.ts) verified passing
- Frontend testing: Installed Vitest 4.0.18, @vitest/ui, @open-wc/testing-helpers, happy-dom
- Created vitest.config.ts with happy-dom environment and coverage configuration
- Added test scripts to apps/front/package.json (test, test:watch, test:coverage)
- Created 3 unit tests for MyElement component (render, click interaction, property check)
- Created 2 accessibility tests for WCAG compliance (basic a11y checks, semantic structure)
- Installed @axe-core/playwright for comprehensive accessibility testing
- Created GitHub Actions CI/CD workflow (.github/workflows/ci.yml) with lint, test, coverage, and accessibility audit jobs
- Created ADR-002 documenting testing strategy decisions
- All 8 tests passing across monorepo: Backend (1 unit), Frontend (3 unit + 2 a11y), Shared (2 unit)
- Coverage reporting configured for both backend (test:cov) and frontend (test:coverage)
- Turbo orchestration working correctly with caching

### File List

- apps/front/vitest.config.ts (NEW)
- apps/front/package.json (MODIFIED - added test scripts and @vitest/coverage-v8)
- apps/front/src/components/my-element.spec.ts (NEW)
- apps/front/test/accessibility.spec.ts (NEW)
- .github/workflows/ci.yml (NEW)
- docs/adr/002-testing-strategy.md (NEW)
- package-lock.json (MODIFIED - dependencies updated)
- CONTRIBUTING.md (MODIFIED - enhanced testing guidelines)
- README.md (MODIFIED - added testing section)

### Code Review Fixes (2026-02-12)

**Issues Fixed:**
1. ✅ [HIGH] Removed unused AxePuppeteer import from accessibility.spec.ts (lint error resolved)
2. ✅ [HIGH] Enhanced CONTRIBUTING.md with comprehensive Vitest, coverage, and accessibility testing guidelines
3. ✅ [MEDIUM] Installed @vitest/coverage-v8 for frontend coverage reporting
4. ✅ [MEDIUM] Added testing section to README.md with commands and references
5.✅ [MEDIUM] Added missing files to File List (package-lock.json, CONTRIBUTING.md, README.md)

**Total Fixes:** 5 issues (2 HIGH, 3 MEDIUM)

