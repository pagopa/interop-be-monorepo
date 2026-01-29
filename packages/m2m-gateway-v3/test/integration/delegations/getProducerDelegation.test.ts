import { describe, it, expect, vi, beforeEach } from "vitest";
import { delegationApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  getMockedApiDelegation,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  delegationService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getProducerDelegations", () => {
  const mockApiDelegation = getMockWithMetadata(
    getMockedApiDelegation({
      kind: delegationApi.DelegationKind.Values.DELEGATED_PRODUCER,
    })
  );

  const mockGetDelegation = vi.fn().mockResolvedValue(mockApiDelegation);

  mockInteropBeClients.delegationProcessClient = {
    delegation: {
      getDelegation: mockGetDelegation,
    },
  } as unknown as PagoPAInteropBeClients["delegationProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetDelegation.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mDelegationResponse: m2mGatewayApiV3.ProducerDelegation = {
      id: mockApiDelegation.data.id,
      delegatorId: mockApiDelegation.data.delegatorId,
      delegateId: mockApiDelegation.data.delegateId,
      eserviceId: mockApiDelegation.data.eserviceId,
      createdAt: mockApiDelegation.data.createdAt,
      updatedAt: mockApiDelegation.data.updatedAt,
      rejectionReason: mockApiDelegation.data.rejectionReason,
      revokedAt: mockApiDelegation.data.stamps.revocation?.when,
      submittedAt: mockApiDelegation.data.stamps.submission.when,
      activatedAt: mockApiDelegation.data.stamps.activation?.when,
      rejectedAt: mockApiDelegation.data.stamps.rejection?.when,
      state: mockApiDelegation.data.state,
    };

    const m2mDelegationsResponse: m2mGatewayApiV3.ProducerDelegation =
      m2mDelegationResponse;

    const result = await delegationService.getProducerDelegation(
      m2mDelegationResponse.id,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mDelegationsResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.delegationProcessClient.delegation.getDelegation,
      params: { delegationId: m2mDelegationResponse.id },
    });
  });
});
