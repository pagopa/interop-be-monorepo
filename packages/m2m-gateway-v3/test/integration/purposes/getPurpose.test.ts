import { m2mGatewayApiV3, purposeApi } from "pagopa-interop-api-clients";
import {
  getMockedApiPurpose,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { generateId, TenantId, unsafeBrandId } from "pagopa-interop-models";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  purposeService,
} from "../../integrationUtils.js";
import {
  getMockM2MAdminAppContext,
  testToM2mGatewayApiPurposeVersion,
} from "../../mockUtils.js";

describe("getPurpose", () => {
  const reviewerWorkflow: purposeApi.ReviewerWorkflow = {
    reviewers: [
      {
        id: generateId(),
        sentToReviewerAt: "2026-10-19T12:00:00.000Z",
      },
    ],
    signingState: purposeApi.RiskAnalysisSigningState.Values.ASSIGNED,
  };
  const expectedReviewerWorkflow = {
    ...reviewerWorkflow,
    reviewers: reviewerWorkflow.reviewers.map(({ id, ...reviewer }) => ({
      ...reviewer,
      userId: id,
    })),
  };

  const mockApiPurposeResponse = getMockWithMetadata({
    ...getMockedApiPurpose(),
    riskAnalysisReviewMode:
      purposeApi.RiskAnalysisReviewMode.Values.ADMIN_WRITES_ADMIN_SIGNS,
    reviewerWorkflow,
  });
  const consumerOrganizationId = unsafeBrandId<TenantId>(
    mockApiPurposeResponse.data.consumerId
  );

  const mockGetPurpose = vi.fn().mockResolvedValue(mockApiPurposeResponse);

  mockInteropBeClients.purposeProcessClient = {
    getPurpose: mockGetPurpose,
  } as unknown as PagoPAInteropBeClients["purposeProcessClient"];

  beforeEach(() => {
    mockGetPurpose.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const purposeVersion = mockApiPurposeResponse.data.versions[0];
    const expectedM2MPurpose: m2mGatewayApiV3.Purpose = {
      consumerId: mockApiPurposeResponse.data.consumerId,
      createdAt: mockApiPurposeResponse.data.createdAt,
      description: mockApiPurposeResponse.data.description,
      eserviceId: mockApiPurposeResponse.data.eserviceId,
      id: mockApiPurposeResponse.data.id,
      isFreeOfCharge: mockApiPurposeResponse.data.isFreeOfCharge,
      title: mockApiPurposeResponse.data.title,
      currentVersion: purposeVersion
        ? testToM2mGatewayApiPurposeVersion(purposeVersion)
        : undefined,
      delegationId: mockApiPurposeResponse.data.delegationId,
      freeOfChargeReason: mockApiPurposeResponse.data.freeOfChargeReason,
      rejectedVersion: undefined,
      suspendedByConsumer: undefined,
      suspendedByProducer: undefined,
      updatedAt: mockApiPurposeResponse.data.updatedAt,
      waitingForApprovalVersion: undefined,
      purposeTemplateId: mockApiPurposeResponse.data.purposeTemplateId,
      riskAnalysisReviewMode:
        mockApiPurposeResponse.data.riskAnalysisReviewMode,
      reviewerWorkflow: expectedReviewerWorkflow,
    };

    const result = await purposeService.getPurpose(
      unsafeBrandId(expectedM2MPurpose.id),
      getMockM2MAdminAppContext({
        organizationId: consumerOrganizationId,
      })
    );

    expect(result).toStrictEqual(expectedM2MPurpose);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.purposeProcessClient.getPurpose,
      params: {
        id: expectedM2MPurpose.id,
      },
    });
  });

  it("Should omit risk analysis review fields for callers outside the consumer organization", async () => {
    const result = await purposeService.getPurpose(
      unsafeBrandId(mockApiPurposeResponse.data.id),
      getMockM2MAdminAppContext({
        organizationId: generateId<TenantId>(),
      })
    );

    expect(result.riskAnalysisReviewMode).toBeUndefined();
    expect(result.reviewerWorkflow).toBeUndefined();
  });
});
