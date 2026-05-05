import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  agreementApi,
  delegationApi,
  m2mGatewayApi,
} from "pagopa-interop-api-clients";
import { generateId, unsafeBrandId } from "pagopa-interop-models";
import {
  getMockedApiAgreement,
  getMockedApiDelegation,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  agreementService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getAgreement", () => {
  const mockStamp: agreementApi.AgreementStamp = {
    who: generateId(),
    when: new Date().toISOString(),
  };
  const mockStampWithDelegationId: agreementApi.AgreementStamp = {
    ...mockStamp,
    delegationId: generateId(),
  };

  const mockDelegations = [getMockedApiDelegation()];

  const mockGetAgreement = vi.fn();
  const mockGetDelegations = vi.fn();

  mockInteropBeClients.agreementProcessClient = {
    getAgreementById: mockGetAgreement,
  } as unknown as PagoPAInteropBeClients["agreementProcessClient"];

  mockInteropBeClients.delegationProcessClient = {
    delegation: { getDelegations: mockGetDelegations },
  } as unknown as PagoPAInteropBeClients["delegationProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetAgreement.mockClear();
    mockGetDelegations.mockClear();
  });

  it.each([
    { submissionStamp: undefined, delegations: [] },
    { submissionStamp: undefined, delegations: mockDelegations },
    { submissionStamp: mockStamp, delegations: [] },
    { submissionStamp: mockStamp, delegations: mockDelegations },
    { submissionStamp: mockStampWithDelegationId, delegations: [] },
    {
      submissionStamp: mockStampWithDelegationId,
      delegations: mockDelegations,
    },
  ])(
    "Should succeed and perform API clients calls",
    async ({ submissionStamp, delegations }) => {
      const mockApiAgreement: agreementApi.Agreement = {
        ...getMockedApiAgreement(),
        stamps: {
          submission: submissionStamp,
        },
      };
      mockGetAgreement.mockResolvedValueOnce(
        getMockWithMetadata(mockApiAgreement)
      );
      mockGetDelegations.mockResolvedValueOnce(
        getMockWithMetadata({ results: delegations })
      );

      const m2mAgreementResponse: m2mGatewayApi.Agreement = {
        id: mockApiAgreement.id,
        eserviceId: mockApiAgreement.eserviceId,
        descriptorId: mockApiAgreement.descriptorId,
        producerId: mockApiAgreement.producerId,
        consumerId: mockApiAgreement.consumerId,
        state: mockApiAgreement.state,
        suspendedByConsumer: mockApiAgreement.suspendedByConsumer,
        suspendedByProducer: mockApiAgreement.suspendedByProducer,
        suspendedByPlatform: mockApiAgreement.suspendedByPlatform,
        consumerNotes: mockApiAgreement.consumerNotes,
        rejectionReason: mockApiAgreement.rejectionReason,
        createdAt: mockApiAgreement.createdAt,
        updatedAt: mockApiAgreement.updatedAt,
        suspendedAt: mockApiAgreement.suspendedAt,
        delegationId: submissionStamp
          ? submissionStamp.delegationId
          : delegations[0]?.id,
      };

      const result = await agreementService.getAgreement(
        unsafeBrandId(mockApiAgreement.id),
        getMockM2MAdminAppContext()
      );

      expect(result).toStrictEqual(m2mAgreementResponse);
      expectApiClientGetToHaveBeenCalledWith({
        mockGet: mockInteropBeClients.agreementProcessClient.getAgreementById,
        params: {
          agreementId: mockApiAgreement.id,
        },
      });
      if (submissionStamp) {
        expect(mockGetDelegations).not.toHaveBeenCalled();
      } else {
        expectApiClientGetToHaveBeenCalledWith({
          mockGet:
            mockInteropBeClients.delegationProcessClient.delegation
              .getDelegations,
          queries: {
            eserviceIds: [mockApiAgreement.eserviceId],
            delegatorIds: [mockApiAgreement.consumerId],
            kind: delegationApi.DelegationKind.Values.DELEGATED_CONSUMER,
            delegationStates: [delegationApi.DelegationState.Values.ACTIVE],
            limit: 1,
            offset: 0,
          },
        });
      }
    }
  );
});
