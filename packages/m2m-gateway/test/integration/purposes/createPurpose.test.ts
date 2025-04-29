/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
  purposeService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import {
  missingMetadata,
  resourcePollingTimeout,
} from "../../../src/model/errors.js";
import {
  getMockM2MAdminAppContext,
  getMockedApiPurpose,
} from "../../mockUtils.js";
import { toM2MPurpose } from "../../../src/api/purposeApiConverter.js";

describe("createPurpose", () => {
  const mockPurposeProcessResponse = getMockedApiPurpose();

  const mockPurposeSeed: m2mGatewayApi.PurposeSeed = {
    consumerId: mockPurposeProcessResponse.data.id,
    dailyCalls: mockPurposeProcessResponse.data.versions[0].dailyCalls,
    description: mockPurposeProcessResponse.data.description,
    eserviceId: mockPurposeProcessResponse.data.eserviceId,
    isFreeOfCharge: mockPurposeProcessResponse.data.isFreeOfCharge,
    title: mockPurposeProcessResponse.data.title,
  };

  const mockM2MPurpose: m2mGatewayApi.Purpose = toM2MPurpose(
    mockPurposeProcessResponse.data
  );

  const mockCreatePurpose = vi.fn().mockResolvedValue(mockM2MPurpose);
  const mockGetPurpose = vi.fn(
    mockPollingResponse(mockPurposeProcessResponse, 2)
  );

  mockInteropBeClients.purposeProcessClient = {
    getPurpose: mockGetPurpose,
    createPurpose: mockCreatePurpose,
  } as unknown as PagoPAInteropBeClients["purposeProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockCreatePurpose.mockClear();
    mockGetPurpose.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mPurposeResponse: m2mGatewayApi.Purpose = mockM2MPurpose;

    const result = await purposeService.createPurpose(
      getMockM2MAdminAppContext(),
      mockPurposeSeed
    );

    expect(result).toEqual(m2mPurposeResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.purposeProcessClient.createPurpose,
      body: mockPurposeSeed,
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.purposeProcessClient.getPurpose,
      params: { delegationId: m2mPurposeResponse.id },
    });
    expect(
      mockInteropBeClients.purposeProcessClient.getPurpose
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw missingMetadata in case the purpose returned by the creation POST call has no metadata", async () => {
    mockCreatePurpose.mockResolvedValueOnce({
      ...mockPurposeProcessResponse,
      metadata: undefined,
    });

    await expect(
      purposeService.createPurpose(getMockM2MAdminAppContext(), mockPurposeSeed)
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the purpose returned by the polling GET call has no metadata", async () => {
    mockGetPurpose.mockResolvedValueOnce({
      ...mockPurposeProcessResponse,
      metadata: undefined,
    });

    await expect(
      purposeService.createPurpose(getMockM2MAdminAppContext(), mockPurposeSeed)
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw resourcePollingTimeout in case of polling max attempts", async () => {
    mockGetPurpose.mockImplementation(
      mockPollingResponse(
        mockPurposeProcessResponse,
        config.defaultPollingMaxAttempts + 1
      )
    );

    await expect(
      purposeService.createPurpose(getMockM2MAdminAppContext(), mockPurposeSeed)
    ).rejects.toThrowError(
      resourcePollingTimeout(config.defaultPollingMaxAttempts)
    );
    expect(mockGetPurpose).toHaveBeenCalledTimes(
      config.defaultPollingMaxAttempts
    );
  });
});
