/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DelegationId,
  descriptorState,
  generateId,
} from "pagopa-interop-models";
import { generateToken, getMockAgreement } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { agreementApi } from "pagopa-interop-api-clients";
import { api, agreementService } from "../vitest.api.setup.js";
import { agreementToApiAgreement } from "../../src/model/domain/apiConverter.js";
import {
  agreementAlreadyExists,
  delegationNotFound,
  descriptorNotInExpectedState,
  eServiceNotFound,
  missingCertifiedAttributesError,
  notLatestEServiceDescriptor,
  organizationIsNotTheDelegateConsumer,
  tenantNotFound,
} from "../../src/model/domain/errors.js";

describe("API POST /agreements test", () => {
  const mockAgreement = getMockAgreement();

  const apiResponse = agreementApi.Agreement.parse(
    agreementToApiAgreement(mockAgreement)
  );

  beforeEach(() => {
    agreementService.createAgreement = vi.fn().mockResolvedValue(mockAgreement);
  });

  const makeRequest = async (
    token: string,
    eserviceId: string = mockAgreement.eserviceId
  ) =>
    request(api)
      .post("/agreements")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({
        eserviceId,
        descriptorId: mockAgreement.descriptorId,
      });

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiResponse);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.ADMIN_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 400 for notLatestEServiceDescriptor", async () => {
    agreementService.createAgreement = vi
      .fn()
      .mockRejectedValue(
        notLatestEServiceDescriptor(mockAgreement.descriptorId)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for descriptorNotInExpectedState", async () => {
    agreementService.createAgreement = vi
      .fn()
      .mockRejectedValue(
        descriptorNotInExpectedState(
          mockAgreement.eserviceId,
          mockAgreement.descriptorId,
          [descriptorState.draft]
        )
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for missingCertifiedAttributesError", async () => {
    agreementService.createAgreement = vi
      .fn()
      .mockRejectedValue(
        missingCertifiedAttributesError(
          mockAgreement.descriptorId,
          mockAgreement.consumerId
        )
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for eServiceNotFound", async () => {
    agreementService.createAgreement = vi
      .fn()
      .mockRejectedValue(eServiceNotFound(mockAgreement.eserviceId));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for delegationNotFound", async () => {
    agreementService.createAgreement = vi
      .fn()
      .mockRejectedValue(delegationNotFound(generateId<DelegationId>()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for tenantNotFound", async () => {
    agreementService.createAgreement = vi
      .fn()
      .mockRejectedValue(tenantNotFound(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 403 for organizationIsNotTheDelegateConsumer", async () => {
    agreementService.createAgreement = vi
      .fn()
      .mockRejectedValue(
        organizationIsNotTheDelegateConsumer(generateId(), undefined)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 409 for agreementAlreadyExists", async () => {
    agreementService.createAgreement = vi
      .fn()
      .mockRejectedValue(
        agreementAlreadyExists(
          mockAgreement.consumerId,
          mockAgreement.eserviceId
        )
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(409);
  });

  it("Should return 400 if passed an invalid eservice id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
