---
name: Error Handling & Resilience
description: Patterns for centralized and resilient error handling across the YouTube Shorter stack.
trigger: glob
globs:
  - "**/*.service.ts"
  - "**/*.controller.ts"
  - "packages/shared/src/types/error.types.ts"
---

# 🛡️ Error Handling & Resilience Skill

## Overview
This project uses a unified strategy for error handling to ensure consistent user feedback and backend stability.

## 🛠️ Backend Pattern (NestJS)
- **Filters**: Use the global `HttpExceptionFilter` to catch and format all outgoing errors.
- **Service Layer**: Do not throw generic `Error`. Use NestJS built-in exceptions like `NotFoundException`, `BadRequestException`, or `InternalServerErrorException`.

```typescript
if (!project) {
  throw new NotFoundException(`Project with ID ${id} not found`);
}
```

---

## 💻 Frontend Pattern (Lit)
- **Axios Interceptors**: Use a central interceptor in `ProjectService` or a future `api-client` to catch 4xx/5xx errors.
- **User Feedback**: Propagate error messages to the UI using Lit Signals. Show toasts or banner components (`yts-toast`).
- **Retry Logic**: Implement retry mechanisms for transient network errors when uploading large video files.

---

## 🧩 Shared Error Types
All API errors SHOULD follow the `ApiResponse` wrapper structure defined in `packages/shared`.

```typescript
export interface ApiErrorResponse {
  success: false;
  message: string;
  statusCode: number;
  timestamp: string;
  path: string;
}
```

## 📝 Rules
1. **Never suppress errors**: Avoid empty `catch {}` blocks. Always log the error or propagate it.
2. **Contextual logging**: Use the backend `Logger` with the class name as context to track error origins.
3. **No leak**: Never send stack traces to the client in production environment.
4. **Retry Strategy**: Limit retries for long-running jobs to prevent infinite loops (e.g., max 3 attempts).
