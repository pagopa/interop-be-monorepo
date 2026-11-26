import { Application } from "express";
import { constants } from "http2";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { generateId, CorrelationId } from "pagopa-interop-models";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../src/app.js";
import { DetectionResponse } from "../../src/model/contracts.js";
import { DetectionService } from "../../src/services/detectionService.js";

const correlationId = generateId<CorrelationId>();
const token = generateToken(authRole.INTERNAL_ROLE);
const fields = [
  { fieldId: "title", text: "qa@example.com" },
  { fieldId: "description", text: "4111111111111111" },
  { fieldId: "empty", text: "" },
];
const results: DetectionResponse["results"] = [
  { fieldId: "title", detectedCategories: ["EMAIL_ADDRESS"] },
  {
    fieldId: "description",
    detectedCategories: ["EMAIL_ADDRESS", "CREDIT_CARD"],
  },
  { fieldId: "empty", detectedCategories: [] },
];
const postDetect = (api: Application, body: object) =>
  request(api)
    .post("/detect")
    .set("X-Correlation-Id", correlationId)
    .set("Authorization", `Bearer ${token}`)
    .send(body);
const fakeService = (returned: unknown = { results }): DetectionService => ({
  detect: async () => returned as DetectionResponse,
});

describe("API POST /detect batch contract", () => {
  it("exposes five active categories while keeping deferred categories inactive", async () => {
    const response = await postDetect(await createApp(), {
      fields: [
        {
          fieldId: "active",
          text: "qa@example.com; IT12345678901; IT60X0542811101000000123456; 4111111111111111; +39 3494096457",
        },
        {
          fieldId: "inactive",
          text: "RSSMRA80A01H501U CA12345AA U1T86I309C 71C68F093D",
        },
      ],
    });
    expect(response.status).toBe(constants.HTTP_STATUS_OK);
    expect(response.body).toEqual({
      results: [
        {
          fieldId: "active",
          detectedCategories: [
            "EMAIL_ADDRESS",
            "IT_VAT_CODE",
            "IT_IBAN_CODE",
            "CREDIT_CARD",
            "IT_PHONE_NUMBER",
          ],
        },
        { fieldId: "inactive", detectedCategories: [] },
      ],
    });
  });
  it("returns categories per field in input order, including an empty field", async () => {
    const response = await postDetect(await createApp(fakeService()), {
      fields,
    });
    expect(response.status).toBe(constants.HTTP_STATUS_OK);
    expect(response.headers["content-type"]).toMatch(/^application\/json\b/);
    expect(response.body).toEqual({ results });
    expect(JSON.stringify(response.body)).not.toContain("qa@example.com");
    expect(JSON.stringify(response.body)).not.toContain("4111111111111111");
  });

  it("rejects the retired single-text request before invoking the detector", async () => {
    const detect = vi.fn(fakeService().detect);
    const response = await postDetect(await createApp({ detect }), {
      text: "qa@example.com",
    });
    expect(response.status).toBe(constants.HTTP_STATUS_BAD_REQUEST);
    expect(detect).not.toHaveBeenCalled();
  });

  it.each([0, 11])("rejects a batch of %s fields", async (count) => {
    const detect = vi.fn(fakeService().detect);
    const response = await postDetect(await createApp({ detect }), {
      fields: Array.from({ length: count }, (_, index) => ({
        fieldId: `field-${index}`,
        text: "",
      })),
    });
    expect(response.status).toBe(constants.HTTP_STATUS_BAD_REQUEST);
    expect(detect).not.toHaveBeenCalled();
  });

  it("rejects duplicate field IDs before invoking the detector", async () => {
    const detect = vi.fn(fakeService().detect);
    const response = await postDetect(await createApp({ detect }), {
      fields: [fields[0], { fieldId: "title", text: "" }],
    });
    expect(response.status).toBe(constants.HTTP_STATUS_BAD_REQUEST);
    expect(detect).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", results.slice(0, 2)],
    ["extra", [...results, { fieldId: "extra", detectedCategories: [] }]],
    ["wrong order", [results[1], results[0], results[2]]],
    ["duplicate ID", [results[0], results[0], results[2]]],
    [
      "unknown category",
      [
        { fieldId: "title", detectedCategories: ["PERSON"] },
        results[1],
        results[2],
      ],
    ],
    [
      "duplicate category",
      [
        {
          fieldId: "title",
          detectedCategories: ["EMAIL_ADDRESS", "EMAIL_ADDRESS"],
        },
        results[1],
        results[2],
      ],
    ],
  ])(
    "rejects %s service output without a partial result",
    async (_case, malformed) => {
      const response = await postDetect(
        await createApp(fakeService({ results: malformed })),
        { fields }
      );
      expect(response.status).toBe(constants.HTTP_STATUS_INTERNAL_SERVER_ERROR);
      expect(response.body).not.toHaveProperty("results");
      expect(JSON.stringify(response.body)).not.toContain("qa@example.com");
    }
  );

  it("rejects detected categories for an empty text field", async () => {
    const response = await postDetect(
      await createApp(
        fakeService({
          results: [
            results[0],
            results[1],
            { fieldId: "empty", detectedCategories: ["EMAIL_ADDRESS"] },
          ],
        })
      ),
      { fields }
    );
    expect(response.status).toBe(constants.HTTP_STATUS_INTERNAL_SERVER_ERROR);
    expect(response.body).not.toHaveProperty("results");
  });

  it("accepts ten fields and returns ten ordered results", async () => {
    const tenFields = Array.from({ length: 10 }, (_, index) => ({
      fieldId: `field-${index}`,
      text: "",
    }));
    const service: DetectionService = {
      detect: async ({ fields: input }) => ({
        results: input.map(({ fieldId }) => ({
          fieldId,
          detectedCategories: [],
        })),
      }),
    };
    const response = await postDetect(await createApp(service), {
      fields: tenFields,
    });
    expect(response.status).toBe(constants.HTTP_STATUS_OK);
    expect(response.body.results).toEqual(
      tenFields.map(({ fieldId }) => ({ fieldId, detectedCategories: [] }))
    );
  });

  it("fails the whole batch when the detector throws", async () => {
    const response = await postDetect(
      await createApp({
        detect: async () => {
          throw new Error("synthetic detector failure");
        },
      }),
      { fields }
    );
    expect(response.status).toBe(constants.HTTP_STATUS_INTERNAL_SERVER_ERROR);
    expect(response.body).not.toHaveProperty("results");
  });

  it("detects independent categories across fields through the production route", async () => {
    const response = await postDetect(await createApp(), { fields });
    expect(response.status).toBe(constants.HTTP_STATUS_OK);
    expect(response.headers["content-type"]).toMatch(/^application\/json\b/);
    expect(response.body).toEqual({
      results: [
        { fieldId: "title", detectedCategories: ["EMAIL_ADDRESS"] },
        { fieldId: "description", detectedCategories: ["CREDIT_CARD"] },
        { fieldId: "empty", detectedCategories: [] },
      ],
    });
    expect(JSON.stringify(response.body)).not.toContain("qa@example.com");
    expect(JSON.stringify(response.body)).not.toContain("4111111111111111");
  });
});
