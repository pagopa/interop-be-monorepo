/* eslint-disable functional/immutable-data */
import { Application } from "express";
import { constants } from "http2";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { CorrelationId, generateId, serviceName } from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import {
  applicationAuditBeginMiddleware,
  applicationAuditEndMiddleware,
} from "../../../application-audit/src/middlewares.js";
import { createApp } from "../../src/app.js";
import { config } from "../../src/config/config.js";
import { DetectionService } from "../../src/services/detectionService.js";
import { auditCapture } from "../auditCapture.js";
import { logCapture } from "../logCapture.js";

const correlationId = generateId<CorrelationId>();
const token = generateToken(authRole.INTERNAL_ROLE);
const sentinel = "SENSITIVE_SENTINEL_9f7b";

const successfulService: DetectionService = {
  detect: async () => ({
    detectedCategories: {
      EMAIL_ADDRESS: false,
      IT_FISCAL_CODE: false,
      IT_VAT_CODE: false,
      IBAN_CODE: false,
      CREDIT_CARD: false,
      PHONE_NUMBER: false,
      IT_IDENTITY_CARD: false,
      IT_DRIVER_LICENSE: false,
    },
  }),
};

const authenticatedRequest = (api: Application, path = "/detect") =>
  request(api)
    .post(path)
    .set("X-Correlation-Id", correlationId)
    .set("Authorization", `Bearer ${token}`);

const createPrivacyApp = async (detectionService?: DetectionService) => {
  const [auditBeginMiddleware, auditEndMiddleware] = await Promise.all([
    applicationAuditBeginMiddleware(serviceName.PII_VALIDATOR, config),
    applicationAuditEndMiddleware(serviceName.PII_VALIDATOR, config),
  ]);

  return createApp(detectionService, {
    auditBeginMiddleware,
    auditEndMiddleware,
  });
};

const assertPrivacyBoundary = async (
  response: request.Response
): Promise<void> => {
  await new Promise<void>((resolve) => setImmediate(resolve));

  const logs = logCapture.entries.join("\n");
  const audit = JSON.stringify(auditCapture.entries);

  expect(logs).toContain("POST");
  expect(logs).toContain("/detect");
  expect(auditCapture.entries).toHaveLength(2);
  expect(auditCapture.entries).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ endpoint: "/detect", httpMethod: "POST" }),
      expect.objectContaining({ endpoint: "/detect", httpMethod: "POST" }),
    ])
  );
  expect(JSON.stringify(response.body)).not.toContain(sentinel);
  expect(logs).not.toContain(sentinel);
  expect(audit).not.toContain(sentinel);
};

beforeEach(() => {
  auditCapture.entries.splice(0);
  logCapture.entries.splice(0);
});

describe("privacy-safe HTTP boundary", () => {
  it("redacts malformed JSON from the response, complete logs and real audit payloads", async () => {
    const api = await createPrivacyApp(successfulService);
    const response = await authenticatedRequest(api)
      .set("Content-Type", "application/json")
      .send(`{"text":"${sentinel}"`);

    expect(response.status).toBe(constants.HTTP_STATUS_BAD_REQUEST);
    expect(response.headers["content-type"]).toMatch(
      /^application\/problem\+json\b/
    );
    await assertPrivacyBoundary(response);
  });

  it("does not log or audit query-string values", async () => {
    const api = await createPrivacyApp(successfulService);
    const response = await authenticatedRequest(
      api,
      `/detect?probe=${sentinel}`
    ).send({ text: "synthetic neutral text" });

    expect(response.status).toBe(constants.HTTP_STATUS_OK);
    await assertPrivacyBoundary(response);
  });

  it("redacts unexpected detector errors from the response, complete logs and real audit payloads", async () => {
    const failingService: DetectionService = {
      detect: async () => {
        throw new Error(`detector failed: ${sentinel}`, {
          cause: new Error(`cause: ${sentinel}`),
        });
      },
    };
    const api = await createPrivacyApp(failingService);
    const response = await authenticatedRequest(api).send({ text: sentinel });

    expect(response.status).toBe(constants.HTTP_STATUS_INTERNAL_SERVER_ERROR);
    expect(response.headers["content-type"]).toMatch(
      /^application\/problem\+json\b/
    );
    await assertPrivacyBoundary(response);
  });

  it("redacts the request text from default 501 logs and real audit payloads", async () => {
    const api = await createPrivacyApp();
    const response = await authenticatedRequest(api).send({ text: sentinel });

    expect(response.status).toBe(constants.HTTP_STATUS_NOT_IMPLEMENTED);
    await assertPrivacyBoundary(response);
  });

  it("redacts invalid request values from validation logs and real audit payloads", async () => {
    const api = await createPrivacyApp(successfulService);
    const response = await authenticatedRequest(api).send({
      text: [sentinel],
    });

    expect(response.status).toBe(constants.HTTP_STATUS_BAD_REQUEST);
    expect(response.headers["content-type"]).toMatch(
      /^application\/problem\+json\b/
    );
    await assertPrivacyBoundary(response);
  });
});
