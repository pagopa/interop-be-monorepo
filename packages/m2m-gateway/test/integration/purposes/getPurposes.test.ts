/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, purposeApi } from "pagopa-interop-api-clients";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  purposeService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  getMockM2MAdminAppContext,
  getMockedApiPurpose,
} from "../../mockUtils.js";
import { toM2MGatewayApiPurpose } from "../../../src/api/purposeApiConverter.js";

describe("getPurposes", () => {
  const mockParams: m2mGatewayApi.GetPurposesQueryParams = {
    eserviceIds: [],
    offset: 0,
    limit: 10,
  };

  const mockApiPurpose1 = getMockedApiPurpose();
  const mockApiPurpose2 = getMockedApiPurpose();

  const mockApiPurposes = [mockApiPurpose1.data, mockApiPurpose2.data];

  const mockPurposeProcessResponse: purposeApi.Purposes = {
    results: mockApiPurposes,
    totalCount: mockApiPurposes.length,
  };

  const mockGetPurposes = vi.fn().mockResolvedValue(mockPurposeProcessResponse);

  mockInteropBeClients.purposeProcessClient = {
    getPurposes: mockGetPurposes,
  } as unknown as PagoPAInteropBeClients["purposeProcessClient"];

  beforeEach(() => {
    mockGetPurposes.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mPurposeResponse1: m2mGatewayApi.Purpose = toM2MGatewayApiPurpose(
      mockApiPurpose1.data
    );
    const m2mPurposeResponse2: m2mGatewayApi.Purpose = toM2MGatewayApiPurpose(
      mockApiPurpose2.data
    );

    const m2mPurposeResponse: m2mGatewayApi.Purposes = {
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount: mockPurposeProcessResponse.totalCount,
      },
      results: [m2mPurposeResponse1, m2mPurposeResponse2],
    };

    const result = await purposeService.getPurposes(
      getMockM2MAdminAppContext(),
      mockParams
    );

    expect(result).toEqual(m2mPurposeResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.purposeProcessClient.getPurposes,
      params: {
        eserviceIds: mockParams.eserviceIds,
        offset: mockParams.offset,
        limit: mockParams.limit,
      },
    });
  });
});
