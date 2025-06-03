import { describe, it, expect, vi, beforeEach } from "vitest";
import { agreementApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { unsafeBrandId } from "pagopa-interop-models";
import {
  agreementService,
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import {
  missingMetadata,
  resourcePollingTimeout,
} from "../../../src/model/errors.js";
import {
  getMockM2MAdminAppContext,
  getMockedApiAgreement,
} from "../../mockUtils.js";
import { getMockWithMetadata } from "pagopa-interop-commons-test";

describe("rejectAgreement", () => {
  const mockAgreementProcessResponse = getMockWithMetadata(
    getMockedApiAgreement({
      state: agreementApi.AgreementState.Values.PENDING,
    })
  );

  const mockRejectAgreementBody: m2mGatewayApi.AgreementRejection = {
    reason: "This is a test reason for rejection",
  };

  const mockRejectAgreement = vi
    .fn()
    .mockResolvedValue(mockAgreementProcessResponse);

  const mockGetAgreement = vi.fn(
    mockPollingResponse(
      mockAgreementProcessResponse,
      config.defaultPollingMaxAttempts
    )
  );

  mockInteropBeClients.agreementProcessClient = {
    rejectAgreement: mockRejectAgreement,
    getAgreementById: mockGetAgreement,
  } as unknown as PagoPAInteropBeClients["agreementProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockRejectAgreement.mockClear();
    mockGetAgreement.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mAgreementResponse: m2mGatewayApi.Agreement = {
      id: mockAgreementProcessResponse.data.id,
      eserviceId: mockAgreementProcessResponse.data.eserviceId,
      descriptorId: mockAgreementProcessResponse.data.descriptorId,
      producerId: mockAgreementProcessResponse.data.producerId,
      consumerId: mockAgreementProcessResponse.data.consumerId,
      state: mockAgreementProcessResponse.data.state,
      createdAt: mockAgreementProcessResponse.data.createdAt,
    };

    const result = await agreementService.rejectAgreement(
      unsafeBrandId(mockAgreementProcessResponse.data.id),
      mockRejectAgreementBody,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mAgreementResponse);
    expect(mockGetAgreement).toHaveBeenCalledTimes(
      config.defaultPollingMaxAttempts
    );
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.agreementProcessClient.rejectAgreement,
      params: {
        agreementId: mockAgreementProcessResponse.data.id,
      },
      body: mockRejectAgreementBody,
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.agreementProcessClient.getAgreementById,
      params: { agreementId: mockAgreementProcessResponse.data.id },
    });
  });

  it("Should throw missingMetadata in case the agreement returned by the reject agreement POST call has no metadata", async () => {
    mockRejectAgreement.mockResolvedValueOnce({
      ...mockAgreementProcessResponse,
      metadata: undefined,
    });

    await expect(
      agreementService.rejectAgreement(
        unsafeBrandId(mockAgreementProcessResponse.data.id),
        mockRejectAgreementBody,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the agreement returned by the polling GET call has no metadata", async () => {
    mockGetAgreement.mockResolvedValueOnce({
      ...mockAgreementProcessResponse,
      metadata: undefined,
    });

    await expect(
      agreementService.rejectAgreement(
        unsafeBrandId(mockAgreementProcessResponse.data.id),
        mockRejectAgreementBody,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw resourcePollingTimeout in case of polling max attempts", async () => {
    mockGetAgreement.mockImplementation(
      mockPollingResponse(
        mockAgreementProcessResponse,
        config.defaultPollingMaxAttempts + 1
      )
    );

    await expect(
      agreementService.rejectAgreement(
        unsafeBrandId(mockAgreementProcessResponse.data.id),
        mockRejectAgreementBody,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      resourcePollingTimeout(config.defaultPollingMaxAttempts)
    );
    expect(mockGetAgreement).toHaveBeenCalledTimes(
      config.defaultPollingMaxAttempts
    );
  });
});
