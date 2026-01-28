import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, purposeApi } from "pagopa-interop-api-clients";
import { getMockedApiPurpose } from "pagopa-interop-commons-test";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  purposeService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext, testToM2mGatewayApiPurposeVersion } from "../../mockUtils.js";
import { WithMaybeMetadata } from "../../../src/clients/zodiosWithMetadataPatch.js";

describe("getPurposes", () => {
  const mockParams: m2mGatewayApi.GetPurposesQueryParams = {
    consumerIds: [],
    states: [],
    eserviceIds: [],
    offset: 0,
    limit: 10,
  };

  const mockApiPurpose1 = getMockedApiPurpose();
  const mockApiPurpose2 = getMockedApiPurpose();

  const mockApiPurposes = [mockApiPurpose1, mockApiPurpose2];

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
    const purposeVersion1 = mockApiPurpose1.versions.at(0);
    const expectedM2MPurpose1: m2mGatewayApi.Purpose = {
      consumerId: mockApiPurpose1.consumerId,
      createdAt: mockApiPurpose1.createdAt,
      description: mockApiPurpose1.description,
      eserviceId: mockApiPurpose1.eserviceId,
      id: mockApiPurpose1.id,
      isFreeOfCharge: mockApiPurpose1.isFreeOfCharge,
      isRiskAnalysisValid: mockApiPurpose1.isRiskAnalysisValid,
      title: mockApiPurpose1.title,
      currentVersion: purposeVersion1
        ? testToM2mGatewayApiPurposeVersion(purposeVersion1)
        : undefined,
      delegationId: mockApiPurpose1.delegationId,
      freeOfChargeReason: mockApiPurpose1.freeOfChargeReason,
      rejectedVersion: undefined,
      suspendedByConsumer: undefined,
      suspendedByProducer: undefined,
      updatedAt: mockApiPurpose1.updatedAt,
      waitingForApprovalVersion: undefined,
      purposeTemplateId: mockApiPurpose1.purposeTemplateId,
    };

    const purposeVersion2 = mockApiPurpose2.versions.at(0);
    const expectedM2MPurpose2: m2mGatewayApi.Purpose = {
      consumerId: mockApiPurpose2.consumerId,
      createdAt: mockApiPurpose2.createdAt,
      description: mockApiPurpose2.description,
      eserviceId: mockApiPurpose2.eserviceId,
      id: mockApiPurpose2.id,
      isFreeOfCharge: mockApiPurpose2.isFreeOfCharge,
      isRiskAnalysisValid: mockApiPurpose2.isRiskAnalysisValid,
      title: mockApiPurpose2.title,
      currentVersion: purposeVersion2
        ? testToM2mGatewayApiPurposeVersion(purposeVersion2)
        : undefined,
      delegationId: mockApiPurpose2.delegationId,
      freeOfChargeReason: mockApiPurpose2.freeOfChargeReason,
      rejectedVersion: undefined,
      suspendedByConsumer: undefined,
      suspendedByProducer: undefined,
      updatedAt: mockApiPurpose2.updatedAt,
      waitingForApprovalVersion: undefined,
      purposeTemplateId: mockApiPurpose2.purposeTemplateId,
    };

    const m2mPurposeResponse: m2mGatewayApi.Purposes = {
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount: mockPurposeProcessResponse.data.totalCount,
      },
      results: [
        expectedM2MPurpose1,
        expectedM2MPurpose2
      ],
    };


    const result = await purposeService.getPurposes(
      mockParams,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(m2mPurposeResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.purposeProcessClient.getPurposes,
      queries: {
        eservicesIds: mockParams.eserviceIds,
        offset: mockParams.offset,
        limit: mockParams.limit,
        consumersIds: [],
        producersIds: [],
        clientId: undefined,
        states: [],
        excludeDraft: false,
        name: undefined,
      },
    });
  });
});
