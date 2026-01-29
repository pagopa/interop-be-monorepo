import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApiV3, purposeApi } from "pagopa-interop-api-clients";
import { unsafeBrandId } from "pagopa-interop-models";
import {
  getMockedApiPurpose,
  getMockedApiPurposeVersion,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  purposeService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getPurposeVersions", () => {
  const mockParams: m2mGatewayApiV3.GetPurposeVersionsQueryParams = {
    state: undefined,
    offset: 0,
    limit: 10,
  };

  const mockApiPurposeVersion1 = getMockedApiPurposeVersion();
  const mockApiPurposeVersion2 = getMockedApiPurposeVersion({
    state: purposeApi.PurposeVersionState.Enum.ACTIVE,
  });
  const mockApiPurposeVersion3 = getMockedApiPurposeVersion({
    state: purposeApi.PurposeVersionState.Enum.DRAFT,
  });
  const mockApiPurposeVersion4 = getMockedApiPurposeVersion({
    state: purposeApi.PurposeVersionState.Enum.ACTIVE,
  });
  const mockApiPurposeVersion5 = getMockedApiPurposeVersion({
    state: purposeApi.PurposeVersionState.Enum.SUSPENDED,
  });

  const mockApiPurpose = getMockWithMetadata(
    getMockedApiPurpose({
      versions: [
        mockApiPurposeVersion1,
        mockApiPurposeVersion2,
        mockApiPurposeVersion3,
        mockApiPurposeVersion4,
        mockApiPurposeVersion5,
      ],
    })
  );
  const mockGetPurpose = vi.fn().mockResolvedValue(mockApiPurpose);

  mockInteropBeClients.purposeProcessClient = {
    getPurpose: mockGetPurpose,
  } as unknown as PagoPAInteropBeClients["purposeProcessClient"];

  beforeEach(() => {
    mockGetPurpose.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mPurposeResponse: m2mGatewayApiV3.PurposeVersions = {
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount: mockApiPurpose.data.versions.length,
      },
      results: [
        mockApiPurposeVersion1,
        mockApiPurposeVersion2,
        mockApiPurposeVersion3,
        mockApiPurposeVersion4,
        mockApiPurposeVersion5,
      ],
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

  it("Should apply filters (offset, limit)", async () => {
    const m2mPurposeResponse: m2mGatewayApiV3.PurposeVersions = {
      pagination: {
        offset: 0,
        limit: 2,
        totalCount: mockApiPurpose.data.versions.length,
      },
      results: [mockApiPurposeVersion1, mockApiPurposeVersion2],
    };
    const result = await purposeService.getPurposeVersions(
      unsafeBrandId(mockApiPurpose.data.id),
      {
        offset: 0,
        limit: 2,
        state: undefined,
      },
      getMockM2MAdminAppContext()
    );
    expect(result).toEqual(m2mPurposeResponse);

    const m2mPurposeResponse2: m2mGatewayApiV3.PurposeVersions = {
      pagination: {
        offset: 2,
        limit: 2,
        totalCount: mockApiPurpose.data.versions.length,
      },
      results: [mockApiPurposeVersion3, mockApiPurposeVersion4],
    };
    const result2 = await purposeService.getPurposeVersions(
      unsafeBrandId(mockApiPurpose.data.id),
      {
        offset: 2,
        limit: 2,
        state: undefined,
      },
      getMockM2MAdminAppContext()
    );
    expect(result2).toEqual(m2mPurposeResponse2);

    const m2mPurposeResponse3: m2mGatewayApiV3.PurposeVersions = {
      pagination: {
        offset: 4,
        limit: 2,
        totalCount: mockApiPurpose.data.versions.length,
      },
      results: [mockApiPurposeVersion5],
    };
    const result3 = await purposeService.getPurposeVersions(
      unsafeBrandId(mockApiPurpose.data.id),
      {
        offset: 4,
        limit: 2,
        state: undefined,
      },
      getMockM2MAdminAppContext()
    );
    expect(result3).toEqual(m2mPurposeResponse3);
  });

  it("Should apply filters (offset, limit, state)", async () => {
    const m2mPurposeResponse1: m2mGatewayApiV3.PurposeVersions = {
      pagination: {
        offset: 0,
        limit: 10,
        totalCount: 2,
      },
      results: [mockApiPurposeVersion2, mockApiPurposeVersion4],
    };
    const result1 = await purposeService.getPurposeVersions(
      unsafeBrandId(mockApiPurpose.data.id),
      {
        offset: 0,
        limit: 10,
        state: purposeApi.PurposeVersionState.Enum.ACTIVE,
      },
      getMockM2MAdminAppContext()
    );
    expect(result1).toEqual(m2mPurposeResponse1);

    const m2mPurposeResponse2: m2mGatewayApiV3.PurposeVersions = {
      pagination: {
        offset: 0,
        limit: 1,
        totalCount: 2,
      },
      results: [mockApiPurposeVersion2],
    };
    const result2 = await purposeService.getPurposeVersions(
      unsafeBrandId(mockApiPurpose.data.id),
      {
        offset: 0,
        limit: 1,
        state: "ACTIVE",
      },
      getMockM2MAdminAppContext()
    );
    expect(result2).toEqual(m2mPurposeResponse2);

    const m2mPurposeResponse3: m2mGatewayApiV3.PurposeVersions = {
      pagination: {
        offset: 0,
        limit: 10,
        totalCount: 1,
      },
      results: [mockApiPurposeVersion5],
    };
    const result3 = await purposeService.getPurposeVersions(
      unsafeBrandId(mockApiPurpose.data.id),
      {
        offset: 0,
        limit: 10,
        state: purposeApi.PurposeVersionState.Enum.SUSPENDED,
      },
      getMockM2MAdminAppContext()
    );
    expect(result3).toEqual(m2mPurposeResponse3);
  });
});
