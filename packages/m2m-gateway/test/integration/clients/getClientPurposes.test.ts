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
import { toM2MGatewayApiPurpose } from "../../../src/api/purposeApiConverter.js";

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

  const mockGetPurposes = vi.fn(
    ({
      queries: { offset, limit, clientId, eservicesIds, states },
    }: {
      queries: purposeApi.GetPurposesQueryParams;
    }) => {
      // Find the client by clientId and get its purposes
      const client = mockApiConsumerClients.find((c) => c.id === clientId);
      const clientPurposeIds = client?.purposes ?? [];

      const purposes = mockApiPurposes.filter((p) => {
        // Filter by client's purposes
        if (!clientPurposeIds.includes(p.id)) {
          return false;
        }
        if (eservicesIds.length > 0 && !eservicesIds.includes(p.eserviceId)) {
          return false;
        }
        const state = p.versions[0].state;
        return states.length === 0 || states.includes(state);
      });

      const results = purposes.slice(offset, offset + limit);

      return Promise.resolve(
        getMockWithMetadata({
          results,
          totalCount: purposes.length,
        })
      );
    }
  );

  mockInteropBeClients.purposeProcessClient = {
    getPurposes: mockGetPurposes,
  } as unknown as PagoPAInteropBeClients["purposeProcessClient"];

  const mockGetClient = vi.fn(({ params: { clientId } }) =>
    getMockWithMetadata(
      mockApiConsumerClients.find((client) => client.id === clientId)
    )
  );

  mockInteropBeClients.authorizationClient = {
    client: {
      getClient: mockGetClient,
    },
  } as unknown as PagoPAInteropBeClients["authorizationClient"];

  const expectedM2MPurpose1: m2mGatewayApi.Purpose =
    toM2MGatewayApiPurpose(mockApiPurpose1);

  const expectedM2MPurpose2: m2mGatewayApi.Purpose =
    toM2MGatewayApiPurpose(mockApiPurpose2);

  const expectedM2MPurpose3: m2mGatewayApi.Purpose =
    toM2MGatewayApiPurpose(mockApiPurpose3);

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
    const result1 = await clientService.getClientPurposes(
      unsafeBrandId(mockApiConsumerClient.id),
      { ...mockParams, offset: 0, limit: 1 },
      getMockM2MAdminAppContext()
    );

    expect(result1).toEqual({
      pagination: {
        offset: 0,
        limit: 1,
        totalCount: 3,
      },
      results: [expectedM2MPurpose1],
    });

    expect(mockGetClient).toHaveBeenCalledTimes(1);
    expect(mockGetPurposes).toHaveBeenCalledTimes(1);

    const result2 = await clientService.getClientPurposes(
      unsafeBrandId(mockApiConsumerClient.id),
      { ...mockParams, offset: 1, limit: 1 },
      getMockM2MAdminAppContext()
    );

    expect(result2).toEqual({
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
    const result1 = await clientService.getClientPurposes(
      unsafeBrandId(mockApiConsumerClient.id),
      {
        ...mockParams,
        eserviceIds: [mockApiPurpose2.eserviceId],
      },
      getMockM2MAdminAppContext()
    );

    expect(result1).toEqual({
      pagination: {
        offset: mockParams.offset,
        limit: mockParams.limit,
        totalCount: 2,
      },
      results: [expectedM2MPurpose2, expectedM2MPurpose3],
    });

    expect(mockGetClient).toHaveBeenCalledTimes(1);
    expect(mockGetPurposes).toHaveBeenCalledTimes(1);

    const result2 = await clientService.getClientPurposes(
      unsafeBrandId(mockApiConsumerClient.id),
      {
        ...mockParams,
        eserviceIds: [mockApiPurpose2.eserviceId],
        states: ["ACTIVE"],
      },
      getMockM2MAdminAppContext()
    );

    expect(result2).toEqual({
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

    expect(result).toEqual({
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount: 0,
      },
      results: [],
    });
  });
});
