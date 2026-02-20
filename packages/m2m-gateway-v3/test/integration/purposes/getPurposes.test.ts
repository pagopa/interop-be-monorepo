import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApiV3, purposeApi } from "pagopa-interop-api-clients";
import { getMockedApiPurpose } from "pagopa-interop-commons-test";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  purposeService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { WithMaybeMetadata } from "../../../src/clients/zodiosWithMetadataPatch.js";

describe("getPurposes", () => {
  const mockParams: m2mGatewayApiV3.GetPurposesQueryParams = {
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
    const expectedM2MPurpose1: m2mGatewayApiV3.Purpose = {
      consumerId: mockApiPurpose1.consumerId,
      createdAt: mockApiPurpose1.createdAt,
      description: mockApiPurpose1.description,
      eserviceId: mockApiPurpose1.eserviceId,
      id: mockApiPurpose1.id,
      isFreeOfCharge: mockApiPurpose1.isFreeOfCharge,
      isRiskAnalysisValid: mockApiPurpose1.isRiskAnalysisValid,
      title: mockApiPurpose1.title,
      currentVersion: mockApiPurpose1.versions.at(0),
      delegationId: mockApiPurpose1.delegationId,
      freeOfChargeReason: mockApiPurpose1.freeOfChargeReason,
      rejectedVersion: undefined,
      suspendedByConsumer: undefined,
      suspendedByProducer: undefined,
      updatedAt: mockApiPurpose1.updatedAt,
      waitingForApprovalVersion: undefined,
      purposeTemplateId: mockApiPurpose1.purposeTemplateId,
    };

    const expectedM2MPurpose2: m2mGatewayApiV3.Purpose = {
      consumerId: mockApiPurpose2.consumerId,
      createdAt: mockApiPurpose2.createdAt,
      description: mockApiPurpose2.description,
      eserviceId: mockApiPurpose2.eserviceId,
      id: mockApiPurpose2.id,
      isFreeOfCharge: mockApiPurpose2.isFreeOfCharge,
      isRiskAnalysisValid: mockApiPurpose2.isRiskAnalysisValid,
      title: mockApiPurpose2.title,
      currentVersion: mockApiPurpose2.versions.at(0),
      delegationId: mockApiPurpose2.delegationId,
      freeOfChargeReason: mockApiPurpose2.freeOfChargeReason,
      rejectedVersion: undefined,
      suspendedByConsumer: undefined,
      suspendedByProducer: undefined,
      updatedAt: mockApiPurpose2.updatedAt,
      waitingForApprovalVersion: undefined,
      purposeTemplateId: mockApiPurpose2.purposeTemplateId,
    };

    const m2mPurposeResponse: m2mGatewayApiV3.Purposes = {
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
