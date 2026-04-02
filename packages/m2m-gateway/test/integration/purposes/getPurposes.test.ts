import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, purposeApi } from "pagopa-interop-api-clients";
import { getMockedApiPurpose } from "pagopa-interop-commons-test";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  purposeService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  getMockM2MAdminAppContext,
  testToM2mGatewayApiPurpose,
  testToM2mGatewayApiPurposeVersion,
} from "../../mockUtils.js";
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
    const expectedM2MPurpose1 = testToM2mGatewayApiPurpose(mockApiPurpose1, {
      currentVersion: purposeVersion1
        ? testToM2mGatewayApiPurposeVersion(purposeVersion1)
        : undefined,
    });

    const purposeVersion2 = mockApiPurpose2.versions.at(0);
    const expectedM2MPurpose2 = testToM2mGatewayApiPurpose(mockApiPurpose2, {
      currentVersion: purposeVersion2
        ? testToM2mGatewayApiPurposeVersion(purposeVersion2)
        : undefined,
    });

    const m2mPurposeResponse: m2mGatewayApi.Purposes = {
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
