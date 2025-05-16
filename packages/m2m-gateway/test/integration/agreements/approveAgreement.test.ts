import { describe, it, expect, vi, beforeEach } from "vitest";
import { agreementApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { unsafeBrandId } from "pagopa-interop-models";
import {
  agreementService,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import {
  agreementNotInPendingState,
  missingMetadata,
  resourcePollingTimeout,
} from "../../../src/model/errors.js";
import {
  getMockM2MAdminAppContext,
  getMockedApiAgreement,
} from "../../mockUtils.js";

describe("approveAgreement", () => {
  const mockAgreementProcessResponse = getMockedApiAgreement({
    state: agreementApi.AgreementState.Values.PENDING,
  });

  const mockActivateAgreement = vi
    .fn()
    .mockResolvedValue(mockAgreementProcessResponse);

  const mockGetAgreement = vi.fn();

  mockInteropBeClients.agreementProcessClient = {
    activateAgreement: mockActivateAgreement,
    getAgreementById: mockGetAgreement,
  } as unknown as PagoPAInteropBeClients["agreementProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockActivateAgreement.mockClear();
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

    mockGetAgreement.mockResolvedValueOnce(mockAgreementProcessResponse);
    mockGetAgreement.mockImplementation(
      mockPollingResponse(
        mockAgreementProcessResponse,
        config.defaultPollingMaxAttempts
      )
    );
    const result = await agreementService.approveAgreement(
      unsafeBrandId(mockAgreementProcessResponse.data.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mAgreementResponse);
    expect(mockGetAgreement).toHaveBeenCalledTimes(
      config.defaultPollingMaxAttempts + 1
    );
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.agreementProcessClient.activateAgreement,
      params: {
        agreementId: mockAgreementProcessResponse.data.id,
      },
    });
  });

  it("Should throw missingMetadata in case the agreement returned by the activate agreement POST call has no metadata", async () => {
    mockGetAgreement.mockResolvedValueOnce(mockAgreementProcessResponse);
    mockActivateAgreement.mockResolvedValueOnce({
      ...mockAgreementProcessResponse,
      metadata: undefined,
    });

    await expect(
      agreementService.approveAgreement(
        unsafeBrandId(mockAgreementProcessResponse.data.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the agreement returned by the polling GET call has no metadata", async () => {
    mockGetAgreement.mockResolvedValueOnce(mockAgreementProcessResponse);
    mockGetAgreement.mockResolvedValueOnce({
      ...mockAgreementProcessResponse,
      metadata: undefined,
    });

    await expect(
      agreementService.approveAgreement(
        unsafeBrandId(mockAgreementProcessResponse.data.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw resourcePollingTimeout in case of polling max attempts", async () => {
    mockGetAgreement.mockResolvedValueOnce(mockAgreementProcessResponse);
    mockGetAgreement.mockImplementation(
      mockPollingResponse(
        mockAgreementProcessResponse,
        config.defaultPollingMaxAttempts + 1
      )
    );

    await expect(
      agreementService.approveAgreement(
        unsafeBrandId(mockAgreementProcessResponse.data.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      resourcePollingTimeout(config.defaultPollingMaxAttempts)
    );
    expect(mockGetAgreement).toHaveBeenCalledTimes(
      config.defaultPollingMaxAttempts + 1
    );
  });

  it("Should throw agreementNotInPendingState if agreement is not in pending state", async () => {
    const mockAgreementProcessResponse = getMockedApiAgreement({
      state: agreementApi.AgreementState.Values.ACTIVE,
    });
    mockGetAgreement.mockResolvedValueOnce(mockAgreementProcessResponse);

    await expect(
      agreementService.approveAgreement(
        unsafeBrandId(mockAgreementProcessResponse.data.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      agreementNotInPendingState(mockAgreementProcessResponse.data.id)
    );
    expect(mockGetAgreement).toHaveBeenCalledTimes(1);
  });
});
