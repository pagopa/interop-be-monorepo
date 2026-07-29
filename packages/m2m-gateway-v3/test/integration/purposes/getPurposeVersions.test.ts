import { m2mGatewayApiV3, purposeApi } from "pagopa-interop-api-clients";
import {
  getMockedApiPurposeVersion,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { generateId, unsafeBrandId } from "pagopa-interop-models";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  purposeService,
} from "../../integrationUtils.js";
import {
  getMockM2MAdminAppContext,
  testToM2mGatewayApiPurposeVersion,
} from "../../mockUtils.js";

describe("getPurposeVersions", () => {
  const purposeId = generateId();

  const mockApiPurposeVersion1 = getMockedApiPurposeVersion();
  const mockApiPurposeVersion2 = getMockedApiPurposeVersion({
    state: purposeApi.PurposeVersionState.Enum.ACTIVE,
  });

  // Pagination is now performed by purpose-process: the gateway only forwards
  // the query params and maps the paginated results.
  const mockProcessResponse = getMockWithMetadata({
    results: [mockApiPurposeVersion1, mockApiPurposeVersion2],
    totalCount: 5,
  });

  const mockGetPurposeVersions = vi.fn().mockResolvedValue(mockProcessResponse);

  mockInteropBeClients.purposeProcessClient = {
    getPurposeVersions: mockGetPurposeVersions,
  } as unknown as PagoPAInteropBeClients["purposeProcessClient"];

  beforeEach(() => {
    mockGetPurposeVersions.mockClear();
  });

  it("Should delegate pagination to purpose-process and map the results", async () => {
    const queryParams: m2mGatewayApiV3.GetPurposeVersionsQueryParams = {
      state: undefined,
      offset: 0,
      limit: 10,
    };

    const expected: m2mGatewayApiV3.PurposeVersions = {
      results: [
        testToM2mGatewayApiPurposeVersion(mockApiPurposeVersion1),
        testToM2mGatewayApiPurposeVersion(mockApiPurposeVersion2),
      ],
      pagination: {
        limit: queryParams.limit,
        offset: queryParams.offset,
        totalCount: 5,
      },
    };

    const result = await purposeService.getPurposeVersions(
      unsafeBrandId(purposeId),
      queryParams,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(expected);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.purposeProcessClient.getPurposeVersions,
      params: { purposeId },
      queries: { state: undefined, offset: 0, limit: 10 },
    });
  });

  it("Should forward the state filter and pagination params to the process", async () => {
    const queryParams: m2mGatewayApiV3.GetPurposeVersionsQueryParams = {
      state: purposeApi.PurposeVersionState.Enum.ACTIVE,
      offset: 2,
      limit: 1,
    };

    await purposeService.getPurposeVersions(
      unsafeBrandId(purposeId),
      queryParams,
      getMockM2MAdminAppContext()
    );

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.purposeProcessClient.getPurposeVersions,
      params: { purposeId },
      queries: { state: "ACTIVE", offset: 2, limit: 1 },
    });
  });
});
