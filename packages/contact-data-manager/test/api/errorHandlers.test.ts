import { contextMiddleware, zodiosCtx } from "pagopa-interop-commons";
import { generateId, serviceName } from "pagopa-interop-models";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import winston from "winston";

import { contactErrorsToApiProblemsMiddleware } from "../../src/utilities/errorHandlers.js";

describe("contact data manager error middleware", () => {
  const email = "private-contact@example.com";

  afterEach(() => vi.restoreAllMocks());

  it.each([
    { error: new SyntaxError(email), status: 400 },
    { error: new Error(email), status: 500 },
    { error: new TypeError(email), status: 500 },
    { error: new RangeError(email), status: 500 },
  ])("hides exception details for $error.name", async ({ error, status }) => {
    const logs = vi.spyOn(winston.Logger.prototype, "log");
    const app = zodiosCtx.app();
    app.use(contextMiddleware(serviceName.CONTACT_DATA_MANAGER));
    app.post("/contacts", () => {
      throw error;
    });
    app.use(contactErrorsToApiProblemsMiddleware);

    const response = await request(app)
      .post("/contacts")
      .set("X-Correlation-Id", generateId());

    expect(response.status).toBe(status);
    expect(JSON.stringify(response.body)).not.toContain(email);
    expect(logs).toHaveBeenCalled();
    expect(JSON.stringify(logs.mock.calls)).not.toContain(email);
  });
});
