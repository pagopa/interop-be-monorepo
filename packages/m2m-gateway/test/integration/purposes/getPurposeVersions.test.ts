import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { unsafeBrandId } from "pagopa-interop-models";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  purposeService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  getMockM2MAdminAppContext,
  getMockedApiPurpose,
  getMockedApiPurposeVersion,
} from "../../mockUtils.js";

describe("getPurposeVersions", () => {
  const mockParams: m2mGatewayApi.GetPurposeVersionsQueryParams = {
    state: undefined,
    offset: 0,
    limit: 10,
  };

  const mockApiPurposeVersion1 = getMockedApiPurposeVersion();
  const mockApiPurposeVersion2 = getMockedApiPurposeVersion({
    state: "ACTIVE",
  });

  const mockApiPurpose = getMockedApiPurpose({
    versions: [mockApiPurposeVersion1, mockApiPurposeVersion2],
  });
  const mockGetPurpose = vi.fn().mockResolvedValue(mockApiPurpose);

  mockInteropBeClients.purposeProcessClient = {
    getPurpose: mockGetPurpose,
  } as unknown as PagoPAInteropBeClients["purposeProcessClient"];

  beforeEach(() => {
    mockGetPurpose.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mPurposeResponse: m2mGatewayApi.PurposeVersions = {
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount: 2,
      },
      results: [mockApiPurposeVersion1, mockApiPurposeVersion2],
    };

    const result = await purposeService.getPurposeVersions(
      unsafeBrandId(mockApiPurpose.data.id),
      mockParams,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mPurposeResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.purposeProcessClient.getPurpose,
      params: { id: mockApiPurpose.data.id },
    });
  });

  it("Should correctly apply pagination from the retrieved purpose", async () => {
    const m2mPurposeResponse: m2mGatewayApi.PurposeVersions = {
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount: 1,
      },
      results: [mockApiPurposeVersion2],
    };

    const result = await purposeService.getPurposeVersions(
      unsafeBrandId(mockApiPurpose.data.id),
      {
        offset: 0,
        limit: 10,
        state: "ACTIVE",
      },
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mPurposeResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.purposeProcessClient.getPurpose,
      params: { id: mockApiPurpose.data.id },
    });
  });
});
