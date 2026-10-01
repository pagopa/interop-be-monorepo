import { m2mGatewayApiV3, purposeApi } from "pagopa-interop-api-clients";
import {
  getMockedApiPurpose,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { generateId, unsafeBrandId, WithMetadata } from "pagopa-interop-models";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
  purposeService,
} from "../../integrationUtils.js";
import {
  getMockM2MAdminAppContext,
  testToM2mGatewayApiPurpose,
} from "../../mockUtils.js";

describe("assignRiskAnalysisReviewer", () => {
  const mockApiPurpose = getMockWithMetadata(
    getMockedApiPurpose({
      versions: [],
    })
  );
  mockApiPurpose.data.riskAnalysisReviewMode =
    purposeApi.RiskAnalysisReviewMode.Enum.REVIEWER_WRITES_REVIEWER_SIGNS;
  const assignmentSeed: m2mGatewayApiV3.RiskAnalysisAssignmentSeed = {
    reviewMode:
      m2mGatewayApiV3.RiskAnalysisReviewMode.Enum
        .REVIEWER_WRITES_REVIEWER_SIGNS,
    reviewerIds: [generateId()],
  };
  const assignmentResponse: WithMetadata<purposeApi.Purpose> = {
    data: mockApiPurpose.data,
    metadata: { version: 1 },
  };
  const mockAssignRiskAnalysisReviewer = vi
    .fn()
    .mockResolvedValue(assignmentResponse);
  const mockGetPurpose = vi.fn(mockPollingResponse(mockApiPurpose, 2));

  mockInteropBeClients.purposeProcessClient = {
    getPurpose: mockGetPurpose,
    assignRiskAnalysisReviewer: mockAssignRiskAnalysisReviewer,
  } as unknown as PagoPAInteropBeClients["purposeProcessClient"];

  beforeEach(() => {
    mockAssignRiskAnalysisReviewer.mockClear();
    mockGetPurpose.mockClear();
  });

  it("Should forward the assignment and poll the updated purpose", async () => {
    mockGetPurpose.mockResolvedValueOnce(mockApiPurpose);

    const expectedPurpose = testToM2mGatewayApiPurpose(mockApiPurpose.data, {});
    const purpose = await purposeService.assignRiskAnalysisReviewer(
      unsafeBrandId(mockApiPurpose.data.id),
      assignmentSeed,
      getMockM2MAdminAppContext()
    );

    expect(purpose).toStrictEqual(expectedPurpose);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockAssignRiskAnalysisReviewer,
      params: { purposeId: mockApiPurpose.data.id },
      body: assignmentSeed,
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetPurpose,
      params: { id: mockApiPurpose.data.id },
    });
  });

  it("Should throw when the assignment response has no metadata", async () => {
    mockAssignRiskAnalysisReviewer.mockResolvedValueOnce({
      data: mockApiPurpose.data,
      metadata: undefined,
    });

    await expect(
      purposeService.assignRiskAnalysisReviewer(
        unsafeBrandId(mockApiPurpose.data.id),
        assignmentSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow();
  });
});
