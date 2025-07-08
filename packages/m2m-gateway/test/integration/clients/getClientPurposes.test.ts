import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  getMockWithMetadata,
  getMockedApiConsumerFullClient,
  getMockedApiPurpose,
} from "pagopa-interop-commons-test";
import { unsafeBrandId } from "pagopa-interop-models";
import {
  clientService,
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientGetToHaveBeenNthCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getClientPurposes", () => {
  const mockParams: m2mGatewayApi.GetClientPurposesQueryParams = {
    offset: 0,
    limit: 10,
  };

  const mockApiPurpose1 = getMockedApiPurpose();
  const mockApiPurpose2 = getMockedApiPurpose();
  const mockApiPurposes = [mockApiPurpose1, mockApiPurpose2];

  const mockGetPurpose = vi.fn(({ params: { id } }) => {
    const purpose = mockApiPurposes.find((p) => p.id === id);
    if (purpose) {
      return Promise.resolve(getMockWithMetadata(purpose));
    }
    return Promise.reject(new Error("Purpose not found"));
  });

  mockInteropBeClients.purposeProcessClient = {
    getPurpose: mockGetPurpose,
  } as unknown as PagoPAInteropBeClients["purposeProcessClient"];

  const mockApiConsumerClient = getMockedApiConsumerFullClient({
    purposes: [mockApiPurpose1.id, mockApiPurpose2.id],
  });

  const mockGetClient = vi
    .fn()
    .mockResolvedValue(getMockWithMetadata(mockApiConsumerClient));

  mockInteropBeClients.authorizationClient = {
    client: {
      getClient: mockGetClient,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  beforeEach(() => {
    mockGetClient.mockClear();
    mockGetPurpose.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const expectedM2MPurpose1: m2mGatewayApi.Purpose = {
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
    };

    const expectedM2MPurpose2: m2mGatewayApi.Purpose = {
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
    };

    const expectedM2MPurposes = [expectedM2MPurpose1, expectedM2MPurpose2];
    const sortedClientPurposeIds = [...mockApiConsumerClient.purposes].sort();
    const m2mClientPurposesResponse: m2mGatewayApi.Purposes = {
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount: mockApiConsumerClient.purposes.length,
      },
      results: sortedClientPurposeIds.map(
        (purposeId) => expectedM2MPurposes.find((p) => p.id === purposeId)!
      ),
    };

    const result = await clientService.getClientPurposes(
      unsafeBrandId(mockApiConsumerClient.id),
      mockParams,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mClientPurposesResponse);

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetClient,
      params: {
        clientId: mockApiConsumerClient.id,
      },
    });
    sortedClientPurposeIds.forEach((id, index) => {
      expectApiClientGetToHaveBeenNthCalledWith({
        nthCall: index + 1,
        mockGet: mockGetPurpose,
        params: {
          id,
        },
      });
    });
  });

  // TODO add also tests for pagination, errors, etc.
});
