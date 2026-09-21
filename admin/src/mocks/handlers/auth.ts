import { http } from "msw";
import { MOCK_USERS } from "../data";
import { withDelay, successResponse, errorResponse, ERROR_CODES } from "../createHandler";

let mockPassword = "admin";

export const authHandlers = [
  http.post("/api/auth/login", async ({ request }) => {
    await withDelay(300);
    const body = (await request.json()) as {
      username: string;
      password: string;
    };
    if (body.username === "admin" && body.password === "admin") {
      return successResponse({
        accessToken: "mock-access-token",
        refreshToken: "mock-refresh-token",
      });
    }
    return errorResponse(ERROR_CODES.INVALID_CREDENTIALS, "Invalid username or password");
  }),

  http.post("/api/auth/refresh", async () => {
    await withDelay(100);
    return successResponse({
      accessToken: "mock-new-access-token",
      refreshToken: "mock-new-refresh-token",
    });
  }),

  http.post("/api/auth/logout", () => successResponse(null)),

  http.post("/api/auth/password", async ({ request }) => {
    await withDelay(200);
    const body = (await request.json()) as { currentPassword?: string; newPassword?: string };
    if (!body.currentPassword || !body.newPassword) {
      return errorResponse("PWD_REQUIRED", "PWD_REQUIRED");
    }
    if (body.currentPassword !== mockPassword) {
      return errorResponse("PWD_ERROR", "PWD_ERROR");
    }
    if (body.newPassword.length < 6) {
      return errorResponse("PWD_TOO_SHORT", "PWD_TOO_SHORT");
    }
    mockPassword = body.newPassword;
    return successResponse(null, "PWD_UPDATED");
  }),

  http.get("/api/auth/user", () => {
    const { permissions: _permissions, ...userWithoutPermissions } = MOCK_USERS[0]!;
    return successResponse(userWithoutPermissions);
  }),

  http.get("/api/auth/permissions", () => successResponse(MOCK_USERS[0]!.permissions)),
];
