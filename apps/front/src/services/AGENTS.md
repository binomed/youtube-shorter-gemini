# 🌐 API Client / Service Layer Rules

Scope strictly `apps/front/src/services/`.

## 📂 Responsibilities
- Implementing robust API clients using **Axios**.
- Managing **SSE (Server-Sent Events)** connections for real-time progress tracking.
- Ensuring strict typings for all request/response DTOs using `@youtube-shorter/shared`.

## 📜 Technical Rules
1. **Singleton Pattern**: Services should be exported as singleton instances.
2. **Strict Typings**: Never use `any` for API responses. Always use or define a DTO in the shared package.
3. **Error Propagation**: Catch Axios errors and throw descriptive `Error` objects with user-friendly messages. Use the `isAxiosError` utility.
4. **SSE Life Cycle**: Ensure `EventSource` connections are properly closed to prevent memory leaks.
