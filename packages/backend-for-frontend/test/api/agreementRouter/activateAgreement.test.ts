/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgreementId, DelegationId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { services, api } from "../../vitest.api.setup.js";
import { getMockBffApiAgreement } from "../../mockUtils.js";
import { agreementDescriptorNotFound } from "../../../src/model/errors.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API POST /agreements/:agreementId/activate", () => {
  const mockApiAgreement = getMockBffApiAgreement();

  beforeEach(() => {
    services.agreementService.activateAgreement = vi
      .fn()
      .mockResolvedValue(mockApiAgreement);
  });

  const makeRequest = async (
    token: string,
    agreementId: AgreementId = generateId(),
    delegationId?: DelegationId
  ) =>
    request(api)
      .post(`${appBasePath}/agreements/${agreementId}/activate`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({ delegationId });

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiAgreement);
  });

  it("Should return 404 for agreementDescriptorNotFound", async () => {
    services.agreementService.activateAgreement = vi
      .fn()
      .mockRejectedValue(agreementDescriptorNotFound(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 400 if passed an invalid agreementId", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as AgreementId);
    expect(res.status).toBe(400);
  });

  it("Should return 400 if passed an invalid delegationId", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId<AgreementId>(),
      "invalid" as DelegationId
    );
    expect(res.status).toBe(400);
  });
});
