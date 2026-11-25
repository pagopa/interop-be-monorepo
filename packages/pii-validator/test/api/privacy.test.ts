/* eslint-disable functional/immutable-data */
import { Application } from "express";
import { constants } from "http2";
import moo from "moo";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { CorrelationId, generateId, serviceName } from "pagopa-interop-models";
import request from "supertest";
import validator from "validator";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applicationAuditBeginMiddleware,
  applicationAuditEndMiddleware,
} from "../../../application-audit/src/middlewares.js";
import { createApp } from "../../src/app.js";
import { config } from "../../src/config/config.js";
import {
  DetectionService,
  detectionService,
} from "../../src/services/detectionService.js";
import { auditCapture } from "../auditCapture.js";
import { logCapture } from "../logCapture.js";

const correlationId = generateId<CorrelationId>();
const token = generateToken(authRole.INTERNAL_ROLE);
const sentinel = "SENSITIVE_SENTINEL_9f7b";

const successfulService: DetectionService = {
  detect: async ({ fields }) => ({
    results: fields.map(({ fieldId }) => ({ fieldId, detectedCategories: [] })),
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
    ).send({ fields: [{ fieldId: "title", text: "synthetic neutral text" }] });

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
    const response = await authenticatedRequest(api).send({
      fields: [{ fieldId: "title", text: sentinel }],
    });

    expect(response.status).toBe(constants.HTTP_STATUS_INTERNAL_SERVER_ERROR);
    expect(response.headers["content-type"]).toMatch(
      /^application\/problem\+json\b/
    );
    await assertPrivacyBoundary(response);
  });

  it("redacts an exception thrown by a checker at the recognizer boundary", async () => {
    const checker = vi.spyOn(validator, "isEmail");
    checker.mockImplementation(() => {
      throw new Error(`checker failed: ${sentinel}`, {
        cause: new Error(`checker cause: ${sentinel}`),
      });
    });
    try {
      const error = await detectionService
        .detect({
          fields: [
            { fieldId: "title", text: `Contatto: ${sentinel}@example.com` },
          ],
        })
        .catch((failure: unknown) => failure);
      expect(error).toBeInstanceOf(Error);
      if (!(error instanceof Error))
        throw new Error("Expected a sanitized error");
      expect(
        JSON.stringify({
          message: error.message,
          cause: error.cause,
          stack: error.stack,
        })
      ).not.toContain(sentinel);
      const api = await createPrivacyApp();
      const response = await authenticatedRequest(api).send({
        fields: [
          { fieldId: "title", text: `Contatto: ${sentinel}@example.com` },
        ],
      });
      expect(checker).toHaveBeenCalled();
      expect(response.status).toBe(constants.HTTP_STATUS_INTERNAL_SERVER_ERROR);
      await assertPrivacyBoundary(response);
    } finally {
      checker.mockRestore();
    }
  });

  it("sanitizes a lexer exception before the mapper and at the actual HTTP boundary", async () => {
    const lexer = vi.spyOn(moo, "compile").mockImplementation(() => {
      throw new Error(`Moo failed: ${sentinel}`, {
        cause: new Error(`raw source: ${sentinel}`),
      });
    });
    try {
      const input = `qa@${sentinel}.com`;
      const error = await detectionService
        .detect({ fields: [{ fieldId: "title", text: input }] })
        .catch((failure: unknown) => failure);
      expect(lexer).toHaveBeenCalled();
      expect(error).toBeInstanceOf(Error);
      if (!(error instanceof Error))
        throw new Error("Expected a sanitized error");
      expect(
        JSON.stringify({
          message: error.message,
          cause: error.cause,
          stack: error.stack,
        })
      ).not.toContain(sentinel);
      const api = await createPrivacyApp();
      const response = await authenticatedRequest(api).send({
        fields: [{ fieldId: "title", text: input }],
      });
      expect(response.status).toBe(constants.HTTP_STATUS_INTERNAL_SERVER_ERROR);
      await assertPrivacyBoundary(response);
    } finally {
      lexer.mockRestore();
    }
  });

  it("redacts an email candidate from production response, logs and audit", async () => {
    const api = await createPrivacyApp();
    const response = await authenticatedRequest(api).send({
      fields: [{ fieldId: "title", text: `Contatto: ${sentinel}@example.com` }],
    });

    expect(response.status).toBe(constants.HTTP_STATUS_OK);
    expect(response.body.results).toEqual([
      { fieldId: "title", detectedCategories: ["EMAIL_ADDRESS"] },
    ]);
    await assertPrivacyBoundary(response);
  });

  it("redacts the request text from production success logs and real audit payloads", async () => {
    const api = await createPrivacyApp();
    const response = await authenticatedRequest(api).send({
      fields: [{ fieldId: "title", text: sentinel }],
    });

    expect(response.status).toBe(constants.HTTP_STATUS_OK);
    await assertPrivacyBoundary(response);
  });

  it("redacts invalid request values from validation logs and real audit payloads", async () => {
    const api = await createPrivacyApp(successfulService);
    const response = await authenticatedRequest(api).send({
      fields: [{ fieldId: "title", text: [sentinel] }],
    });

    expect(response.status).toBe(constants.HTTP_STATUS_BAD_REQUEST);
    await assertPrivacyBoundary(response);
  });

  it.each([
    [
      "unknown nested key",
      { fields: [{ fieldId: "title", text: "", [sentinel]: true }] },
    ],
    [
      "unknown top-level key",
      { fields: [{ fieldId: "title", text: "" }], [sentinel]: true },
    ],
    [
      "duplicate field ID",
      {
        fields: [
          { fieldId: sentinel, text: "" },
          { fieldId: sentinel, text: "" },
        ],
      },
    ],
  ])("redacts %s from 400, logs and audit", async (_case, body) => {
    const api = await createPrivacyApp(successfulService);
    const response = await authenticatedRequest(api).send(body);
    expect(response.status).toBe(constants.HTTP_STATUS_BAD_REQUEST);
    await assertPrivacyBoundary(response);
  });

  it("redacts malformed service output with a sensitive field ID", async () => {
    const api = await createPrivacyApp({
      detect: async () => ({
        results: [{ fieldId: sentinel, detectedCategories: [] }],
      }),
    });
    const response = await authenticatedRequest(api).send({
      fields: [{ fieldId: "title", text: "" }],
    });
    expect(response.status).toBe(constants.HTTP_STATUS_INTERNAL_SERVER_ERROR);
    await assertPrivacyBoundary(response);
  });
});
