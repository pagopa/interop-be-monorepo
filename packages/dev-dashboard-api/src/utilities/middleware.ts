import type {
  ErrorRequestHandler,
  Request,
  RequestHandler,
  Response,
} from "express";

import { constants } from "node:http2";
import { ZodError } from "zod";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export const dashboardMutationMiddleware: RequestHandler = (
  request,
  response,
  next
) => {
  if (!safeMethods.has(request.method)) {
    const origin = request.get("Origin");

    if (
      request.get("Sec-Fetch-Site") === "cross-site" ||
      (origin && origin !== `${request.protocol}://${request.get("host")}`)
    ) {
      response.status(constants.HTTP_STATUS_FORBIDDEN).json({
        error: "Cross-origin dashboard mutations are forbidden",
      });
      return;
    }

    if (request.method !== "DELETE" && !request.is("application/json")) {
      response
        .status(constants.HTTP_STATUS_BAD_REQUEST)
        .json({ error: "JSON body required" });
      return;
    }
  }

  next();
};

export const dashboardErrorMiddleware: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next
) => {
  const malformedJson = error instanceof SyntaxError;

  response
    .status(
      error instanceof ZodError || malformedJson
        ? constants.HTTP_STATUS_BAD_REQUEST
        : constants.HTTP_STATUS_CONFLICT
    )
    .json({
      error:
        error instanceof Error ? error.message : "Dashboard request failed",
    });
};

export const asyncHandler =
  (
    handler: (request: Request, response: Response) => Promise<void>
  ): RequestHandler =>
  (request, response, next) => {
    void handler(request, response).catch(next);
  };
