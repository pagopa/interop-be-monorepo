import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, purposeApi } from "pagopa-interop-api-clients";
import {
  getMockWithMetadata,
  getMockedApiConsumerFullClient,
  getMockedApiPurpose,
  getMockedApiPurposeVersion,
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
    eserviceIds: [],
    states: [],
  };

  const mockApiPurpose1 = getMockedApiPurpose();
  const mockApiPurpose2 = getMockedApiPurpose();
  const mockApiPurpose3 = {
    ...getMockedApiPurpose({
      versions: [
        getMockedApiPurposeVersion({
          state: "ACTIVE",
        }),
      ],
    }),
    eserviceId: mockApiPurpose2.eserviceId,
  };
  const mockApiPurposes = [mockApiPurpose1, mockApiPurpose2, mockApiPurpose3];

  const mockApiConsumerClient = getMockedApiConsumerFullClient({
    purposes: [mockApiPurpose1.id, mockApiPurpose2.id, mockApiPurpose3.id],
  });
  const mockApiConsumerClient2 = getMockedApiConsumerFullClient({
    purposes: [],
  });
  const mockApiConsumerClients = [
    mockApiConsumerClient,
    mockApiConsumerClient2,
  ];

  const mockResponse = getMockWithMetadata({
    results: mockApiPurposes,
    totalCount: mockApiPurposes.length,
  });

  const mockGetPurposes = vi.fn();

  mockInteropBeClients.purposeProcessClient = {
    getPurposes: mockGetPurposes,
  } as unknown as PagoPAInteropBeClients["purposeProcessClient"];

  const mockGetClient = vi.fn(({ params: { clientId } }) =>
    getMockWithMetadata(
      mockApiConsumerClients.find((client) => client.id === clientId)
    )
  );

  const testToM2mGatewayApiPurposeVersion = (
    version: purposeApi.PurposeVersion
  ): m2mGatewayApi.PurposeVersion => ({
    id: version.id,
    createdAt: version.createdAt,
    dailyCalls: version.dailyCalls,
    state: version.state,
    firstActivationAt: version.firstActivationAt,
    rejectionReason: version.rejectionReason,
    suspendedAt: version.suspendedAt,
    updatedAt: version.updatedAt,
  });

  mockInteropBeClients.authorizationClient = {
    client: {
      getClient: mockGetClient,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

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

  const mockPurposeVersion3 = mockApiPurpose3.versions.at(0);
  const expectedM2MPurpose3: m2mGatewayApi.Purpose = {
    consumerId: mockApiPurpose3.consumerId,
    createdAt: mockApiPurpose3.createdAt,
    description: mockApiPurpose3.description,
    eserviceId: mockApiPurpose3.eserviceId,
    id: mockApiPurpose3.id,
    isFreeOfCharge: mockApiPurpose3.isFreeOfCharge,
    isRiskAnalysisValid: mockApiPurpose3.isRiskAnalysisValid,
    title: mockApiPurpose3.title,
    currentVersion: mockPurposeVersion3
      ? testToM2mGatewayApiPurposeVersion(mockPurposeVersion3)
      : undefined,
    delegationId: mockApiPurpose3.delegationId,
    freeOfChargeReason: mockApiPurpose3.freeOfChargeReason,
    rejectedVersion: undefined,
    suspendedByConsumer: undefined,
    suspendedByProducer: undefined,
    updatedAt: mockApiPurpose3.updatedAt,
    waitingForApprovalVersion: undefined,
    purposeTemplateId: mockApiPurpose3.purposeTemplateId,
  };

  beforeEach(() => {
    mockGetClient.mockClear();
    mockGetPurposes.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mClientPurposesResponse: m2mGatewayApi.Purposes = {
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount: mockApiConsumerClient.purposes.length,
      },
      results: [expectedM2MPurpose1, expectedM2MPurpose2, expectedM2MPurpose3],
    };

    mockGetPurposes.mockResolvedValue(mockResponse);

    const result = await clientService.getClientPurposes(
      unsafeBrandId(mockApiConsumerClient.id),
      mockParams,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(m2mClientPurposesResponse);

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetClient,
      params: {
        clientId: mockApiConsumerClient.id,
      },
    });
    expectApiClientGetToHaveBeenNthCalledWith({
      nthCall: 1,
      mockGet: mockGetPurposes,
      queries: {
        eservicesIds: [],
        limit: mockParams.limit,
        offset: mockParams.offset,
        consumersIds: [],
        producersIds: [],
        clientId: mockApiConsumerClient.id,
        states: [],
        excludeDraft: false,
        name: "",
      },
    });
  });

  it("Should apply filters (offset, limit)", async () => {
    const getMockApiPurpose1 = getMockWithMetadata({
      ...mockResponse.data,
      results: [mockApiPurpose1],
    });
    mockGetPurposes.mockResolvedValueOnce(getMockApiPurpose1);

    const result1 = await clientService.getClientPurposes(
      unsafeBrandId(mockApiConsumerClient.id),
      { ...mockParams, offset: 0, limit: 1 },
      getMockM2MAdminAppContext()
    );

    expect(result1).toStrictEqual({
      pagination: {
        offset: 0,
        limit: 1,
        totalCount: 3,
      },
      results: [expectedM2MPurpose1],
    });

    expect(mockGetClient).toHaveBeenCalledTimes(1);
    expect(mockGetPurposes).toHaveBeenCalledTimes(1);

    const getMockApiPurpose2 = getMockWithMetadata({
      ...mockResponse.data,
      results: [mockApiPurpose2],
    });
    mockGetPurposes.mockResolvedValue(getMockApiPurpose2);
    const result2 = await clientService.getClientPurposes(
      unsafeBrandId(mockApiConsumerClient.id),
      { ...mockParams, offset: 1, limit: 1 },
      getMockM2MAdminAppContext()
    );

    expect(result2).toStrictEqual({
      pagination: {
        offset: 1,
        limit: 1,
        totalCount: 3,
      },
      results: [expectedM2MPurpose2],
    });

    expect(mockGetClient).toHaveBeenCalledTimes(2);
    expect(mockGetPurposes).toHaveBeenCalledTimes(2);
  });

  it("Should apply filters (eserviceId, state)", async () => {
    const getPartialMockResponse = getMockWithMetadata({
      results: [mockApiPurpose2, mockApiPurpose3],
      totalCount: 2,
    });
    mockGetPurposes.mockResolvedValueOnce(getPartialMockResponse);
    const result1 = await clientService.getClientPurposes(
      unsafeBrandId(mockApiConsumerClient.id),
      {
        ...mockParams,
        eserviceIds: [mockApiPurpose2.eserviceId],
      },
      getMockM2MAdminAppContext()
    );

    expect(result1).toStrictEqual({
      pagination: {
        offset: mockParams.offset,
        limit: mockParams.limit,
        totalCount: 2,
      },
      results: [expectedM2MPurpose2, expectedM2MPurpose3],
    });

    expect(mockGetClient).toHaveBeenCalledTimes(1);
    expect(mockGetPurposes).toHaveBeenCalledTimes(1);

    const getPartialMockResponse3 = getMockWithMetadata({
      results: [mockApiPurpose3],
      totalCount: 1,
    });
    mockGetPurposes.mockResolvedValueOnce(getPartialMockResponse3);
    const result2 = await clientService.getClientPurposes(
      unsafeBrandId(mockApiConsumerClient.id),
      {
        ...mockParams,
        eserviceIds: [mockApiPurpose2.eserviceId],
        states: ["ACTIVE"],
      },
      getMockM2MAdminAppContext()
    );

    expect(result2).toStrictEqual({
      pagination: {
        offset: mockParams.offset,
        limit: mockParams.limit,
        totalCount: 1,
      },
      results: [expectedM2MPurpose3],
    });

    expect(mockGetClient).toHaveBeenCalledTimes(2);
    expect(mockGetPurposes).toHaveBeenCalledTimes(2);
  });

  it("Should return an empty array if the client has no purposes", async () => {
    const result = await clientService.getClientPurposes(
      unsafeBrandId(mockApiConsumerClient2.id),
      mockParams,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual({
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount: 0,
      },
      results: [],
    });
  });
});
