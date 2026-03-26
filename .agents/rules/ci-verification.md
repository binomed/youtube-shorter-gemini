# CI Verification Rule

All AI agents MUST verify that the code compiles, passes linting, and passes all tests before completing a task, submitting code for review, or **PERFORMING ANY GIT COMMIT**.

> [!IMPORTANT]
> **CI Verification is a hard blocker for Commits.**
> You ARE NOT ALLOWED to run `git commit` unless you have verified that `npm run lint`, `npm run build`, and `npm run test` pass in the current working state.

## Mandatory Commands

Before finishing a story or task, you MUST run the following commands and ensure they all pass:

```bash
# Verify the entire project
npm run lint
npm run build
npm run test

# Verify frontend accessibility (critical for CI)
npm run test:a11y --workspace=front
```

## Failure Handling

If any of these commands fail:
1. Analyze the output to identify the errors.
2. Fix the issues in the code or tests.
3. Re-run the verification commands.
4. DO NOT mark the task as complete or request review until all commands pass.

## Rationale

This rule prevents pushing code that breaks the Continuous Integration (CI) pipeline, ensuring a stable main branch and reducing the manual fix-up work for the user.
