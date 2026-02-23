/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgreementId, generateId } from "pagopa-interop-models";
import { generateToken, getMockAgreement } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { agreementApi } from "pagopa-interop-api-clients";
import { api, agreementService } from "../vitest.api.setup.js";
import { agreementDocumentToApiAgreementDocument } from "../../src/model/domain/apiConverter.js";
import {
  agreementNotFound,
  tenantIsNotTheConsumer,
  tenantIsNotTheDelegateConsumer,
  tenantIsNotTheDelegateProducer,
  tenantIsNotTheProducer,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";
import { getMockConsumerDocument } from "../mockUtils.js";

describe("API GET /agreements/{agreementId}/consumer-documents test", () => {
  const mockAgreement = getMockAgreement();
  const mockConsumerDocument1 = getMockConsumerDocument(mockAgreement.id);
  const mockConsumerDocument2 = getMockConsumerDocument(mockAgreement.id);

  const mockProcessRespomse = {
    results: [mockConsumerDocument1, mockConsumerDocument2],
    totalCount: 2,
  };

  const apiResponse = agreementApi.Documents.parse({
    results: mockProcessRespomse.results.map(
      agreementDocumentToApiAgreementDocument
    ),
    totalCount: mockProcessRespomse.totalCount,
  });

  const mockQueryParams: agreementApi.GetAgreementConsumerDocumentsQueryParams =
    {
      offset: 0,
      limit: 10,
    };

  beforeEach(() => {
    agreementService.getAgreementConsumerDocuments = vi
      .fn()
      .mockResolvedValue(mockProcessRespomse);
  });

  const makeRequest = async (
    token: string,
    agreementId: AgreementId,
    query: agreementApi.GetAgreementConsumerDocumentsQueryParams = mockQueryParams
  ) =>
    request(api)
      .get(`/agreements/${agreementId}/consumer-documents`)
      .query(query)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockAgreement.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
      expect(
        agreementService.getAgreementConsumerDocuments
      ).toHaveBeenCalledWith(
        mockAgreement.id,
        mockQueryParams,
        expect.any(Object) // context
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockAgreement.id);
    expect(res.status).toBe(403);
  });

  it.each([
    { error: agreementNotFound(generateId()), expectedStatus: 404 },
    {
      error: tenantNotAllowed(generateId()),
      expectedStatus: 403,
    },
    {
      error: tenantIsNotTheConsumer(generateId()),
      expectedStatus: 403,
    },
    {
      error: tenantIsNotTheDelegateConsumer(generateId(), undefined),
      expectedStatus: 403,
    },
    {
      error: tenantIsNotTheProducer(generateId()),
      expectedStatus: 403,
    },
    {
      error: tenantIsNotTheDelegateProducer(generateId(), undefined),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      agreementService.getAgreementConsumerDocuments = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.M2M_ROLE);
      const res = await makeRequest(token, mockAgreement.id);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed invalid agreement id", async () => {
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token, "invalid" as AgreementId);
    expect(res.status).toBe(400);
  });

  it.each([
    {},
    { ...mockQueryParams, offset: -2 },
    { ...mockQueryParams, limit: 100 },
    { ...mockQueryParams, offset: "invalidOffset" },
    { ...mockQueryParams, limit: "invalidLimit" },
  ])("Should return 400 if passed invalid query params", async (query) => {
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(
      token,
      generateId<AgreementId>(),
      query as unknown as agreementApi.GetAgreementConsumerDocumentsQueryParams
    );

    expect(res.status).toBe(400);
  });
});
