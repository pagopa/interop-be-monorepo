import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, purposeApi } from "pagopa-interop-api-clients";
import { genericLogger } from "pagopa-interop-commons";
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
import {
  toGetPurposesApiQueryParams,
  toM2MGatewayApiPurpose,
} from "../../../src/api/purposeApiConverter.js";
import { WithMaybeMetadata } from "../../../src/clients/zodiosWithMetadataPatch.js";
import { purposeNotFound } from "../../../src/model/errors.js";

describe("getPurposes", () => {
  const mockParams: m2mGatewayApi.GetPurposesQueryParams = {
    eserviceIds: [],
    offset: 0,
    limit: 10,
  };

  const mockApiPurpose1 = getMockedApiPurpose();
  const mockApiPurpose2 = getMockedApiPurpose();

  const mockApiPurposes = [mockApiPurpose1.data, mockApiPurpose2.data];

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
    const m2mPurposeResponse1: m2mGatewayApi.Purpose = toM2MGatewayApiPurpose({
      purpose: mockApiPurpose1.data,
      logger: genericLogger,
    });
    const m2mPurposeResponse2: m2mGatewayApi.Purpose = toM2MGatewayApiPurpose({
      purpose: mockApiPurpose2.data,
      logger: genericLogger,
    });

    const m2mPurposeResponse: m2mGatewayApi.Purposes = {
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount: mockPurposeProcessResponse.data.totalCount,
      },
      results: [m2mPurposeResponse1, m2mPurposeResponse2],
    };

    const result = await purposeService.getPurposes(
      mockParams,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mPurposeResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.purposeProcessClient.getPurposes,
      queries: toGetPurposesApiQueryParams(mockParams),
    });
  });

  it("Should throw a 400 purposeNotFound error due to missing valid current version", async () => {
    const invalidPurpose = getMockedApiPurpose({
      versions: [
        getMockedApiPurposeVersion({ state: "WAITING_FOR_APPROVAL" }),
        getMockedApiPurposeVersion({ state: "REJECTED" }),
      ],
    });

    const mockInvalidPurposeProcessResponse: WithMaybeMetadata<purposeApi.Purposes> =
      {
        data: {
          results: [invalidPurpose.data],
          totalCount: 1,
        },
        metadata: undefined,
      };

    const mockGetPurposes = vi
      .fn()
      .mockResolvedValue(mockInvalidPurposeProcessResponse);

    mockInteropBeClients.purposeProcessClient = {
      getPurposes: mockGetPurposes,
    } as unknown as PagoPAInteropBeClients["purposeProcessClient"];

    await expect(
      purposeService.getPurposes(mockParams, getMockM2MAdminAppContext())
    ).rejects.toThrow(purposeNotFound(invalidPurpose.data.id));
  });
});
