/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, expect, it, vi } from "vitest";
import { AgreementId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { agreementService, api } from "../../vitest.api.setup.js";
import { getMockApiCreatedResource } from "../../mockUtils.js";
import { config } from "../../../src/config/config.js";

describe("API POST /agreements/:agreementId/clone", () => {
  const mockAgreementId = generateId<AgreementId>();
  const mockApiCreatedResource = getMockApiCreatedResource();

  agreementService.cloneAgreement = vi
    .fn()
    .mockResolvedValue(mockApiCreatedResource);

  const makeRequest = async (
    token: string,
    agreementId: string = mockAgreementId
  ) =>
    request(api)
      .post(
        `/backend-for-frontend/${config.backendForFrontendInterfaceVersion}/agreements/${agreementId}/clone`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiCreatedResource);
  });

  // TODO: why doesn't this method have a 404 error?
  // I can see it in the api, but not in the error mapper

  it("Should return 400 if passed an invalid parameter", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
