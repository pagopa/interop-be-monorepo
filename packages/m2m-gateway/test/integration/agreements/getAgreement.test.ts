import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { unsafeBrandId } from "pagopa-interop-models";
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
  const mockApiAgreement = getMockWithMetadata(getMockedApiAgreement());

  const mockGetAgreement = vi.fn().mockResolvedValue(mockApiAgreement);
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
  });

  it.each([{ delegations: [getMockedApiDelegation()] }, { delegations: [] }])(
    "Should succeed and perform API clients calls",
    async ({ delegations }) => {
      mockGetDelegations.mockResolvedValueOnce(
        getMockWithMetadata({ results: delegations })
      );

      const m2mAgreementResponse: m2mGatewayApi.Agreement = {
        id: mockApiAgreement.data.id,
        eserviceId: mockApiAgreement.data.eserviceId,
        descriptorId: mockApiAgreement.data.descriptorId,
        producerId: mockApiAgreement.data.producerId,
        consumerId: mockApiAgreement.data.consumerId,
        state: mockApiAgreement.data.state,
        suspendedByConsumer: mockApiAgreement.data.suspendedByConsumer,
        suspendedByProducer: mockApiAgreement.data.suspendedByProducer,
        suspendedByPlatform: mockApiAgreement.data.suspendedByPlatform,
        consumerNotes: mockApiAgreement.data.consumerNotes,
        rejectionReason: mockApiAgreement.data.rejectionReason,
        createdAt: mockApiAgreement.data.createdAt,
        updatedAt: mockApiAgreement.data.updatedAt,
        suspendedAt: mockApiAgreement.data.suspendedAt,
        delegationId: delegations.at(0)?.id,
      };

      const result = await agreementService.getAgreement(
        unsafeBrandId(mockApiAgreement.data.id),
        getMockM2MAdminAppContext()
      );

      expect(result).toEqual(m2mAgreementResponse);
      expectApiClientGetToHaveBeenCalledWith({
        mockGet: mockInteropBeClients.agreementProcessClient.getAgreementById,
        params: {
          agreementId: mockApiAgreement.data.id,
        },
      });
    }
  );
});
