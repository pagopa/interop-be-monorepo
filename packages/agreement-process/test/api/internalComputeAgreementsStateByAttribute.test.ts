/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { badRequestError, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { agreementApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { api, agreementService } from "../vitest.api.setup.js";

describe("API POST /internal/compute/agreementsState test", () => {
  const defaultBody: agreementApi.ComputeAgreementStatePayload = {
    attributeId: generateId(),
    consumer: { id: generateId(), attributes: [] },
  };

  beforeEach(() => {
    agreementService.internalComputeAgreementsStateByAttribute = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    body: agreementApi.ComputeAgreementStatePayload = defaultBody
  ) =>
    request(api)
      .post("/internal/compute/agreementsState")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role Internal", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.INTERNAL_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([{ error: badRequestError("bad request", []), expectedStatus: 400 }])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      agreementService.internalComputeAgreementsStateByAttribute = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { body: {} },
    { body: { ...defaultBody, attributeId: undefined } },
    { body: { ...defaultBody, consumer: undefined } },
    { body: { ...defaultBody, attributeId: "invalid" } },
    { body: { ...defaultBody, consumer: { id: "invalid", attributes: [] } } },
    { body: { ...defaultBody, extraField: 1 } },
  ])("Should return 400 if passed invalid data: %s", async ({ body }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      body as agreementApi.ComputeAgreementStatePayload
    );
    expect(res.status).toBe(400);
  });
});
