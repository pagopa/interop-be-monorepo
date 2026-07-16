/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { agreementApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockAgreement,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  AgreementId,
  DelegationId,
  agreementState,
  generateId,
} from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { agreementToApiAgreement } from "../../src/model/domain/apiConverter.js";
import {
  agreementActivationFailed,
  agreementAlreadyExists,
  agreementNotFound,
  agreementNotInExpectedState,
  descriptorNotInExpectedState,
  tenantIsNotTheDelegate,
  notLatestEServiceDescriptor,
  tenantIsNotTheDelegateProducer,
  tenantIsNotTheProducer,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";
import { api, agreementService } from "../vitest.api.setup.js";

describe("API POST /agreements/{agreementId}/approve test", () => {
  const mockAgreement = getMockAgreement();
  const serviceResponse = getMockWithMetadata(mockAgreement);

  const apiResponse = agreementApi.Agreement.parse(
    agreementToApiAgreement(mockAgreement)
  );

  beforeEach(() => {
    agreementService.approveAgreement = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const makeRequest = async (
    token: string,
    agreementId: AgreementId = mockAgreement.id,
    delegationId?: DelegationId
  ) =>
    request(api)
      .post(`/agreements/${agreementId}/approve`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({ delegationId });

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([
    { error: notLatestEServiceDescriptor(generateId()), expectedStatus: 400 },
    {
      error: agreementNotInExpectedState(
        mockAgreement.id,
        agreementState.draft
      ),
      expectedStatus: 400,
    },
    { error: agreementActivationFailed(mockAgreement.id), expectedStatus: 400 },
    {
      error: descriptorNotInExpectedState(generateId(), generateId(), []),
      expectedStatus: 400,
    },
    { error: agreementNotFound(mockAgreement.id), expectedStatus: 404 },
    {
      error: tenantIsNotTheDelegateProducer(
        generateId(),
        generateId<DelegationId>()
      ),
      expectedStatus: 403,
    },
    { error: tenantIsNotTheProducer(generateId()), expectedStatus: 403 },
    { error: tenantNotAllowed(generateId()), expectedStatus: 403 },
    {
      error: agreementAlreadyExists(generateId(), generateId()),
      expectedStatus: 409,
    },
    {
      error: tenantIsNotTheDelegate(generateId()),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      agreementService.approveAgreement = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { agreementId: "invalid" as AgreementId },
    { agreementId: mockAgreement.id, delegationId: "invalid" as DelegationId },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ agreementId, delegationId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, agreementId, delegationId);
      expect(res.status).toBe(400);
    }
  );
});

describe("API POST /agreements/{agreementId}/unsuspend test", () => {
  const mockAgreement = getMockAgreement();
  const serviceResponse = getMockWithMetadata(mockAgreement);

  const apiResponse = agreementApi.Agreement.parse(
    agreementToApiAgreement(mockAgreement)
  );

  beforeEach(() => {
    agreementService.unsuspendAgreement = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const makeRequest = async (
    token: string,
    agreementId: AgreementId = mockAgreement.id,
    delegationId?: DelegationId
  ) =>
    request(api)
      .post(`/agreements/${agreementId}/unsuspend`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({ delegationId });

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([
    { error: notLatestEServiceDescriptor(generateId()), expectedStatus: 400 },
    {
      error: agreementNotInExpectedState(
        mockAgreement.id,
        agreementState.draft
      ),
      expectedStatus: 400,
    },
    { error: agreementActivationFailed(mockAgreement.id), expectedStatus: 400 },
    {
      error: descriptorNotInExpectedState(generateId(), generateId(), []),
      expectedStatus: 400,
    },
    { error: agreementNotFound(mockAgreement.id), expectedStatus: 404 },
    {
      error: tenantIsNotTheDelegateProducer(
        generateId(),
        generateId<DelegationId>()
      ),
      expectedStatus: 403,
    },
    { error: tenantIsNotTheProducer(generateId()), expectedStatus: 403 },
    { error: tenantNotAllowed(generateId()), expectedStatus: 403 },
    {
      error: agreementAlreadyExists(generateId(), generateId()),
      expectedStatus: 409,
    },
    {
      error: tenantIsNotTheDelegate(generateId()),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      agreementService.unsuspendAgreement = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { agreementId: "invalid" as AgreementId },
    { agreementId: mockAgreement.id, delegationId: "invalid" as DelegationId },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ agreementId, delegationId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, agreementId, delegationId);
      expect(res.status).toBe(400);
    }
  );
});
