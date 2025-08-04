import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, agreementApi } from "pagopa-interop-api-clients";
import {
  getMockedApiAgreement,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  agreementService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { WithMaybeMetadata } from "../../../src/clients/zodiosWithMetadataPatch.js";

describe("getAgreements", () => {
  const mockQueryParams: m2mGatewayApi.GetAgreementsQueryParams = {
    consumerIds: [],
    eserviceIds: [],
    producerIds: [],
    states: [],
    offset: 0,
    limit: 10,
  };

  const mockApiAgreement1 = getMockWithMetadata(getMockedApiAgreement());
  const mockApiAgreement2 = getMockWithMetadata(getMockedApiAgreement());

  const mockApiAgreements = [mockApiAgreement1.data, mockApiAgreement2.data];

  const mockAgreementProcessResponse: WithMaybeMetadata<agreementApi.Agreements> =
    {
      data: {
        results: mockApiAgreements,
        totalCount: mockApiAgreements.length,
      },
      metadata: undefined,
    };

  const mockGetAgreements = vi
    .fn()
    .mockResolvedValue(mockAgreementProcessResponse);

  mockInteropBeClients.agreementProcessClient = {
    getAgreements: mockGetAgreements,
  } as unknown as PagoPAInteropBeClients["agreementProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetAgreements.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mAgreementResponse1: m2mGatewayApi.Agreement = {
      id: mockApiAgreement1.data.id,
      eserviceId: mockApiAgreement1.data.eserviceId,
      descriptorId: mockApiAgreement1.data.descriptorId,
      producerId: mockApiAgreement1.data.producerId,
      consumerId: mockApiAgreement1.data.consumerId,
      state: mockApiAgreement1.data.state,
      suspendedByConsumer: mockApiAgreement1.data.suspendedByConsumer,
      suspendedByProducer: mockApiAgreement1.data.suspendedByProducer,
      suspendedByPlatform: mockApiAgreement1.data.suspendedByPlatform,
      consumerNotes: mockApiAgreement1.data.consumerNotes,
      rejectionReason: mockApiAgreement1.data.rejectionReason,
      createdAt: mockApiAgreement1.data.createdAt,
      updatedAt: mockApiAgreement1.data.updatedAt,
      suspendedAt: mockApiAgreement1.data.suspendedAt,
    };

    const m2mAgreementResponse2: m2mGatewayApi.Agreement = {
      id: mockApiAgreement2.data.id,
      eserviceId: mockApiAgreement2.data.eserviceId,
      descriptorId: mockApiAgreement2.data.descriptorId,
      producerId: mockApiAgreement2.data.producerId,
      consumerId: mockApiAgreement2.data.consumerId,
      state: mockApiAgreement2.data.state,
      suspendedByConsumer: mockApiAgreement2.data.suspendedByConsumer,
      suspendedByProducer: mockApiAgreement2.data.suspendedByProducer,
      suspendedByPlatform: mockApiAgreement2.data.suspendedByPlatform,
      consumerNotes: mockApiAgreement2.data.consumerNotes,
      rejectionReason: mockApiAgreement2.data.rejectionReason,
      createdAt: mockApiAgreement2.data.createdAt,
      updatedAt: mockApiAgreement2.data.updatedAt,
      suspendedAt: mockApiAgreement2.data.suspendedAt,
    };

    const m2mAgreementsResponse: m2mGatewayApi.Agreements = {
      pagination: {
        limit: mockQueryParams.limit,
        offset: mockQueryParams.offset,
        totalCount: mockAgreementProcessResponse.data.totalCount,
      },
      results: [m2mAgreementResponse1, m2mAgreementResponse2],
    };

    const result = await agreementService.getAgreements(
      mockQueryParams,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mAgreementsResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.agreementProcessClient.getAgreements,
      queries: {
        consumersIds: mockQueryParams.consumerIds,
        eservicesIds: mockQueryParams.eserviceIds,
        producersIds: mockQueryParams.producerIds,
        descriptorsIds: [],
        showOnlyUpgradeable: false,
        states: mockQueryParams.states,
        offset: mockQueryParams.offset,
        limit: mockQueryParams.limit,
      },
    });
  });
});
