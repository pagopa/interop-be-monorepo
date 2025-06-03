import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, purposeApi } from "pagopa-interop-api-clients";
import {
  getMockedApiPurpose,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  purposeService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { toGetPurposesApiQueryParams } from "../../../src/api/purposeApiConverter.js";
import { WithMaybeMetadata } from "../../../src/clients/zodiosWithMetadataPatch.js";

describe("getPurposes", () => {
  const mockParams: m2mGatewayApi.GetPurposesQueryParams = {
    eserviceIds: [],
    offset: 0,
    limit: 10,
  };

  const mockApiPurpose1 = getMockWithMetadata(getMockedApiPurpose());
  const mockApiPurpose2 = getMockWithMetadata(getMockedApiPurpose());

  const mockApiPurposes = [mockApiPurpose1.data, mockApiPurpose2.data];

  const mockPurposeProcessResponse: WithMaybeMetadata<purposeApi.Purposes> = {
    data: {
      results: mockApiPurposes,
      totalCount: mockApiPurposes.length,
    },
    metadata: undefined,
  };

  const mockGetPurposes = vi.fn().mockResolvedValue(mockPurposeProcessResponse);

  mockInteropBeClients.purposeProcessClient = {
    getPurposes: mockGetPurposes,
  } as unknown as PagoPAInteropBeClients["purposeProcessClient"];

  beforeEach(() => {
    mockGetPurposes.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const expectedM2MPurpose1: m2mGatewayApi.Purpose = {
      consumerId: mockApiPurpose1.data.consumerId,
      createdAt: mockApiPurpose1.data.createdAt,
      description: mockApiPurpose1.data.description,
      eserviceId: mockApiPurpose1.data.eserviceId,
      id: mockApiPurpose1.data.id,
      isFreeOfCharge: mockApiPurpose1.data.isFreeOfCharge,
      isRiskAnalysisValid: mockApiPurpose1.data.isRiskAnalysisValid,
      title: mockApiPurpose1.data.title,
      currentVersion: mockApiPurpose1.data.versions.at(0),
      delegationId: mockApiPurpose1.data.delegationId,
      freeOfChargeReason: mockApiPurpose1.data.freeOfChargeReason,
      rejectedVersion: undefined,
      suspendedByConsumer: undefined,
      suspendedByProducer: undefined,
      updatedAt: mockApiPurpose1.data.updatedAt,
      waitingForApprovalVersion: undefined,
    };

    const expectedM2MPurpose2: m2mGatewayApi.Purpose = {
      consumerId: mockApiPurpose2.data.consumerId,
      createdAt: mockApiPurpose2.data.createdAt,
      description: mockApiPurpose2.data.description,
      eserviceId: mockApiPurpose2.data.eserviceId,
      id: mockApiPurpose2.data.id,
      isFreeOfCharge: mockApiPurpose2.data.isFreeOfCharge,
      isRiskAnalysisValid: mockApiPurpose2.data.isRiskAnalysisValid,
      title: mockApiPurpose2.data.title,
      currentVersion: mockApiPurpose2.data.versions.at(0),
      delegationId: mockApiPurpose2.data.delegationId,
      freeOfChargeReason: mockApiPurpose2.data.freeOfChargeReason,
      rejectedVersion: undefined,
      suspendedByConsumer: undefined,
      suspendedByProducer: undefined,
      updatedAt: mockApiPurpose2.data.updatedAt,
      waitingForApprovalVersion: undefined,
    };

    const m2mPurposeResponse: m2mGatewayApi.Purposes = {
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount: mockPurposeProcessResponse.data.totalCount,
      },
      results: [expectedM2MPurpose1, expectedM2MPurpose2],
    };

    const result = await purposeService.getPurposes(
      mockParams,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mPurposeResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.purposeProcessClient.getPurposes,
      queries: toGetPurposesApiQueryParams(mockParams),
    });
  });
});
