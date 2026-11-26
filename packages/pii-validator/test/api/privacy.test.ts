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
import { italianDriverLicensePatterns } from "../../src/services/regexRules.js";
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
  it.each([
    ["isCieCandidate", "CA12345AA"],
    ["isItalianDriverLicenseCandidate", "U1B123456C"],
  ] as const)(
    "sanitizes %s failures and discards prior batch results",
    async (name, text) => {
      const identityCheck = validator.isIdentityCard;
      const licencePattern = italianDriverLicensePatterns.letterPrefixedSerial;
      const licenceCheck = licencePattern.test.bind(licencePattern);
      const original =
        name === "isCieCandidate"
          ? (value: string) => identityCheck(value, "IT")
          : licenceCheck;
      const failOnDocument = (value: string) => {
        if (value === text) {
          throw new Error(`document failed: ${sentinel}`, {
            cause: new Error(sentinel),
          });
        }
        return original(value);
      };
      const checker =
        name === "isCieCandidate"
          ? vi
              .spyOn(validator, "isIdentityCard")
              .mockImplementation(failOnDocument)
          : vi.spyOn(licencePattern, "test").mockImplementation(failOnDocument);
      const body = {
        fields: [
          { fieldId: "first", text: "qa@example.com" },
          { fieldId: "document", text },
        ],
      };
      try {
        const error = await detectionService
          .detect(body)
          .catch((failure: unknown) => failure);
        expect(error).toBeInstanceOf(Error);
        if (!(error instanceof Error))
          throw new Error("Expected sanitized failure");
        expect(error.message).toBe("PII recognition failed");
        expect(error.cause).toBeUndefined();
        expect(error.stack).not.toContain(sentinel);
        const response = await authenticatedRequest(
          await createPrivacyApp()
        ).send(body);
        expect(response.status).toBe(
          constants.HTTP_STATUS_INTERNAL_SERVER_ERROR
        );
        expect(response.body).not.toHaveProperty("results");
        expect(checker.mock.calls.map(([value]) => value)).toContain(text);
        await assertPrivacyBoundary(response);
      } finally {
        checker.mockRestore();
      }
    }
  );

  it("returns document categories per field without exposing their values", async () => {
    const response = await authenticatedRequest(await createPrivacyApp()).send({
      fields: [
        { fieldId: "identity", text: "CA12345AA" },
        { fieldId: "licence", text: "U1B123456C" },
      ],
    });
    expect(response.status).toBe(constants.HTTP_STATUS_OK);
    expect(response.body).toEqual({
      results: [
        { fieldId: "identity", detectedCategories: ["IT_CIE"] },
        { fieldId: "licence", detectedCategories: ["IT_DRIVER_LICENSE"] },
      ],
    });
    await assertPrivacyBoundary(response);
    const exposed = JSON.stringify([
      response.body,
      logCapture.entries,
      auditCapture.entries,
    ]);
    expect(exposed).not.toContain("CA12345AA");
    expect(exposed).not.toContain("U1B123456C");
  });

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

  it("redacts a second-field checker failure without returning the first result", async () => {
    const isEmail = validator.isEmail;
    const checker = vi.spyOn(validator, "isEmail");
    checker.mockImplementation((candidate) => {
      if (candidate.includes(sentinel)) {
        throw new Error(`checker failed: ${sentinel}`, {
          cause: new Error(`checker cause: ${sentinel}`),
        });
      }
      return isEmail(candidate);
    });
    try {
      const error = await detectionService
        .detect({
          fields: [
            { fieldId: "first", text: "qa@example.com" },
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
      expect(error.message).toBe("PII recognition failed");
      expect(error.cause).toBeUndefined();
      const api = await createPrivacyApp();
      const response = await authenticatedRequest(api).send({
        fields: [
          { fieldId: "first", text: "qa@example.com" },
          { fieldId: "title", text: `Contatto: ${sentinel}@example.com` },
        ],
      });
      expect(checker).toHaveBeenNthCalledWith(1, "qa@example.com");
      expect(checker).toHaveBeenNthCalledWith(2, `${sentinel}@example.com`);
      expect(response.status).toBe(constants.HTTP_STATUS_INTERNAL_SERVER_ERROR);
      expect(response.body).not.toHaveProperty("results");
      await assertPrivacyBoundary(response);
    } finally {
      checker.mockRestore();
    }
  });

  it.each(["creation", "iteration"])(
    "sanitizes lexer %s exceptions before the mapper and at the actual HTTP boundary",
    async (stage) => {
      const compile = moo.compile;
      const lexer = vi.spyOn(moo, "compile").mockImplementation((rules) => {
        const fail = () => {
          throw new Error(`Moo failed: ${sentinel}`, {
            cause: new Error(`raw source: ${sentinel}`),
          });
        };
        if (stage === "creation") return fail();
        const result = compile(rules);
        result.next = fail;
        return result;
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
        expect(error.message).toBe("PII recognition failed");
        expect(error.cause).toBeUndefined();
        const api = await createPrivacyApp();
        const response = await authenticatedRequest(api).send({
          fields: [{ fieldId: "title", text: input }],
        });
        expect(response.status).toBe(
          constants.HTTP_STATUS_INTERNAL_SERVER_ERROR
        );
        await assertPrivacyBoundary(response);
      } finally {
        lexer.mockRestore();
      }
    }
  );

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
