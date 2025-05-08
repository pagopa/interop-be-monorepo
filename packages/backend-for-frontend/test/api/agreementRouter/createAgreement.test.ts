/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, expect, it, vi } from "vitest";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { bffApi } from "pagopa-interop-api-clients";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { services, api } from "../../vitest.api.setup.js";
import {
  getMockApiAgreementPayload,
  getMockApiCreatedResource,
} from "../../mockUtils.js";
import { config } from "../../../src/config/config.js";

describe("API POST /agreements", () => {
  const mockAgreementPayload: bffApi.AgreementPayload =
    getMockApiAgreementPayload();
  const mockAgreement: bffApi.CreatedResource = getMockApiCreatedResource();

  // eslint-disable-next-line functional/immutable-data
  services.agreementService.createAgreement = vi.fn().mockResolvedValue(mockAgreement);

  const makeRequest = async (token: string, payload = mockAgreementPayload) =>
    request(api)
      .post(
        `/backend-for-frontend/${config.backendForFrontendInterfaceVersion}/agreements`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(payload);

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockAgreement);
  });

  it("Should return 400 if passed an invalid parameter", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, {
      ...mockAgreementPayload,
      eserviceId: "invalid",
    });
    expect(res.status).toBe(400);
  });
});
