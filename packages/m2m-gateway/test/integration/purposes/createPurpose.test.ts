import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { genericLogger } from "pagopa-interop-commons";
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
import { toM2MGatewayApiPurpose } from "../../../src/api/purposeApiConverter.js";

describe("createPurpose", () => {
  const mockPurposeProcessGetResponse = getMockedApiPurpose();

  const mockPurposeSeed: m2mGatewayApi.PurposeSeed = {
    consumerId: mockPurposeProcessGetResponse.data.id,
    dailyCalls: mockPurposeProcessGetResponse.data.versions[0].dailyCalls,
    description: mockPurposeProcessGetResponse.data.description,
    eserviceId: mockPurposeProcessGetResponse.data.eserviceId,
    isFreeOfCharge: mockPurposeProcessGetResponse.data.isFreeOfCharge,
    title: mockPurposeProcessGetResponse.data.title,
  };

  const mockM2MPurpose: m2mGatewayApi.Purpose = toM2MGatewayApiPurpose({
    purpose: mockPurposeProcessGetResponse.data,
    logger: genericLogger,
  });

  const mockCreatePurpose = vi
    .fn()
    .mockResolvedValue(mockPurposeProcessGetResponse);
  const mockGetPurpose = vi.fn(
    mockPollingResponse(mockPurposeProcessGetResponse, 2)
  );

  mockInteropBeClients.purposeProcessClient = {
    getPurpose: mockGetPurpose,
    createPurpose: mockCreatePurpose,
  } as unknown as PagoPAInteropBeClients["purposeProcessClient"];

  beforeEach(() => {
    mockCreatePurpose.mockClear();
    mockGetPurpose.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mPurposeResponse: m2mGatewayApi.Purpose = mockM2MPurpose;

    const result = await purposeService.createPurpose(
      mockPurposeSeed,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mPurposeResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.purposeProcessClient.createPurpose,
      body: mockPurposeSeed,
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.purposeProcessClient.getPurpose,
      params: { id: m2mPurposeResponse.id },
    });
    expect(
      mockInteropBeClients.purposeProcessClient.getPurpose
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw missingMetadata in case the purpose returned by the creation POST call has no metadata", async () => {
    mockCreatePurpose.mockResolvedValueOnce({
      ...mockPurposeProcessGetResponse,
      metadata: undefined,
    });

    await expect(
      purposeService.createPurpose(mockPurposeSeed, getMockM2MAdminAppContext())
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the purpose returned by the polling GET call has no metadata", async () => {
    mockGetPurpose.mockResolvedValueOnce({
      ...mockPurposeProcessGetResponse,
      metadata: undefined,
    });

    await expect(
      purposeService.createPurpose(mockPurposeSeed, getMockM2MAdminAppContext())
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw resourcePollingTimeout in case of polling max attempts", async () => {
    mockGetPurpose.mockImplementation(
      mockPollingResponse(
        mockPurposeProcessGetResponse,
        config.defaultPollingMaxAttempts + 1
      )
    );

    await expect(
      purposeService.createPurpose(mockPurposeSeed, getMockM2MAdminAppContext())
    ).rejects.toThrowError(
      resourcePollingTimeout(config.defaultPollingMaxAttempts)
    );
    expect(mockGetPurpose).toHaveBeenCalledTimes(
      config.defaultPollingMaxAttempts
    );
  });
});
