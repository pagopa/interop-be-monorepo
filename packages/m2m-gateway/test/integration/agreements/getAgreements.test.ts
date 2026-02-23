import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, agreementApi } from "pagopa-interop-api-clients";
import {
  getMockWithMetadata,
  getMockedApiAgreement,
  getMockedApiDelegation,
} from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
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
    consumerIds: [generateId(), generateId()],
    eserviceIds: [generateId(), generateId()],
    producerIds: [generateId(), generateId()],
    descriptorIds: [generateId(), generateId()],
    states: [
      m2mGatewayApi.AgreementState.Values.ACTIVE,
      m2mGatewayApi.AgreementState.Values.SUSPENDED,
    ],
    offset: 0,
    limit: 10,
  };

  const mockApiAgreement1 = { ...getMockedApiAgreement(), stamps: {} };
  const mockApiAgreement2 = getMockedApiAgreement();

  const mockApiAgreements = [mockApiAgreement1, mockApiAgreement2];

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

  const mockDelegation = getMockedApiDelegation();
  mockInteropBeClients.delegationProcessClient = {
    delegation: {
      getDelegations: vi
        .fn()
        .mockResolvedValue(getMockWithMetadata({ results: [mockDelegation] })),
    },
  } as unknown as PagoPAInteropBeClients["delegationProcessClient"];

  mockInteropBeClients.agreementProcessClient = {
    getAgreements: mockGetAgreements,
  } as unknown as PagoPAInteropBeClients["agreementProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetAgreements.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mAgreementResponse1: m2mGatewayApi.Agreement = {
      id: mockApiAgreement1.id,
      eserviceId: mockApiAgreement1.eserviceId,
      descriptorId: mockApiAgreement1.descriptorId,
      producerId: mockApiAgreement1.producerId,
      consumerId: mockApiAgreement1.consumerId,
      state: mockApiAgreement1.state,
      suspendedByConsumer: mockApiAgreement1.suspendedByConsumer,
      suspendedByProducer: mockApiAgreement1.suspendedByProducer,
      suspendedByPlatform: mockApiAgreement1.suspendedByPlatform,
      consumerNotes: mockApiAgreement1.consumerNotes,
      rejectionReason: mockApiAgreement1.rejectionReason,
      createdAt: mockApiAgreement1.createdAt,
      updatedAt: mockApiAgreement1.updatedAt,
      suspendedAt: mockApiAgreement1.suspendedAt,
      delegationId: mockDelegation.id,
    };

    const m2mAgreementResponse2: m2mGatewayApi.Agreement = {
      id: mockApiAgreement2.id,
      eserviceId: mockApiAgreement2.eserviceId,
      descriptorId: mockApiAgreement2.descriptorId,
      producerId: mockApiAgreement2.producerId,
      consumerId: mockApiAgreement2.consumerId,
      state: mockApiAgreement2.state,
      suspendedByConsumer: mockApiAgreement2.suspendedByConsumer,
      suspendedByProducer: mockApiAgreement2.suspendedByProducer,
      suspendedByPlatform: mockApiAgreement2.suspendedByPlatform,
      consumerNotes: mockApiAgreement2.consumerNotes,
      rejectionReason: mockApiAgreement2.rejectionReason,
      createdAt: mockApiAgreement2.createdAt,
      updatedAt: mockApiAgreement2.updatedAt,
      suspendedAt: mockApiAgreement2.suspendedAt,
      delegationId: mockApiAgreement2.stamps.submission?.delegationId,
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

    expect(result).toStrictEqual(m2mAgreementsResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.agreementProcessClient.getAgreements,
      queries: {
        consumersIds: mockQueryParams.consumerIds,
        eservicesIds: mockQueryParams.eserviceIds,
        producersIds: mockQueryParams.producerIds,
        descriptorsIds: mockQueryParams.descriptorIds,
        showOnlyUpgradeable: false,
        states: mockQueryParams.states,
        offset: mockQueryParams.offset,
        limit: mockQueryParams.limit,
      },
    });
  });
});
