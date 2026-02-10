# ADR 001: Monorepo Structure

## Status
Accepted

## Context
We need a structure to manage multiple applications (frontend, backend) and shared code efficiently.

## Decision
We use **Turborepo** with **npm workspaces**.
- `apps/back`: NestJS
- `apps/front`: Lit + Vite
- `packages/shared`: Shared Types/DTOs

## Consequences
- Unified build pipeline.
- Easier code sharing between front and back.
- Centralized dependency management.
