import { Application } from "express";
import { constants } from "http2";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { generateId, CorrelationId } from "pagopa-interop-models";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { DetectionService } from "../../src/services/detectionService.js";

const correlationId = generateId<CorrelationId>();
const token = generateToken(authRole.INTERNAL_ROLE);

const completeCategoryMap = {
  EMAIL_ADDRESS: false,
  IT_FISCAL_CODE: false,
  IT_VAT_CODE: false,
  IBAN_CODE: false,
  CREDIT_CARD: false,
  PHONE_NUMBER: false,
  IT_IDENTITY_CARD: false,
  IT_DRIVER_LICENSE: false,
} as const;

const postDetect = (api: Application, text: string) =>
  request(api)
    .post("/detect")
    .set("X-Correlation-Id", correlationId)
    .set("Authorization", `Bearer ${token}`)
    .send({ text });

describe("API POST /detect scaffold contract", () => {
  it("serializes the complete future response from an injected fake", async () => {
    const fakeService: DetectionService = {
      detect: async () => ({ detectedCategories: completeCategoryMap }),
    };
    const api = await createApp(fakeService);

    const response = await postDetect(api, "synthetic neutral text");

    expect(response.status).toBe(constants.HTTP_STATUS_OK);
    expect(response.headers["content-type"]).toMatch(/^application\/json\b/);
    expect(response.body).toEqual({
      detectedCategories: completeCategoryMap,
    });
    expect(response.body.detectedCategories).not.toHaveProperty("PERSON");
  });

  it("returns a redacted 501 from the production default", async () => {
    const api = await createApp();

    const response = await postDetect(api, "synthetic neutral text");

    expect(response.status).toBe(constants.HTTP_STATUS_NOT_IMPLEMENTED);
    expect(response.headers["content-type"]).toMatch(
      /^application\/problem\+json\b/
    );
    expect(response.body).toMatchObject({
      type: "about:blank",
      status: constants.HTTP_STATUS_NOT_IMPLEMENTED,
      title: "Detection not implemented",
      correlationId,
    });
    expect(response.body).not.toHaveProperty("detectedCategories");
    expect(JSON.stringify(response.body)).not.toContain(
      "synthetic neutral text"
    );
  });
});
