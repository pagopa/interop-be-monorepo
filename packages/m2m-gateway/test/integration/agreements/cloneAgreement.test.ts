import { beforeEach, describe, expect, it, vi } from "vitest";
import { agreementApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiAgreement,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
  agreementService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("cloneAgreement", () => {
  const mockAgreementProcessResponse = getMockWithMetadata(
    getMockedApiAgreement({
      state: agreementApi.AgreementState.Values.REJECTED,
    })
  );

  const pollingTentatives = 2;
  const mockCloneAgreement = vi
    .fn()
    .mockResolvedValue(mockAgreementProcessResponse);
  const mockGetAgreement = vi.fn(
    mockPollingResponse(mockAgreementProcessResponse, pollingTentatives)
  );

  mockInteropBeClients.agreementProcessClient = {
    getAgreementById: mockGetAgreement,
    cloneAgreement: mockCloneAgreement,
  } as unknown as PagoPAInteropBeClients["agreementProcessClient"];

  beforeEach(() => {
    mockCloneAgreement.mockClear();
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
      delegationId:
        mockAgreementProcessResponse.data.stamps.submission?.delegationId,
    };

    const result = await agreementService.cloneAgreement(
      unsafeBrandId(mockAgreementProcessResponse.data.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mAgreementResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.agreementProcessClient.cloneAgreement,
      params: {
        agreementId: mockAgreementProcessResponse.data.id,
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.agreementProcessClient.getAgreementById,
      params: { agreementId: mockAgreementProcessResponse.data.id },
    });
    expect(
      mockInteropBeClients.agreementProcessClient.getAgreementById
    ).toHaveBeenCalledTimes(pollingTentatives);
  });

  it("Should throw missingMetadata in case the agreement returned by the clone agreement POST call has no metadata", async () => {
    mockCloneAgreement.mockResolvedValueOnce({
      ...mockAgreementProcessResponse,
      metadata: undefined,
    });

    await expect(
      agreementService.cloneAgreement(
        unsafeBrandId(mockAgreementProcessResponse.data.id),
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
      agreementService.cloneAgreement(
        unsafeBrandId(mockAgreementProcessResponse.data.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    // The clone will first get the agreement, then perform the polling
    mockGetAgreement.mockImplementation(
      mockPollingResponse(
        mockAgreementProcessResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      agreementService.cloneAgreement(
        unsafeBrandId(mockAgreementProcessResponse.data.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetAgreement).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries
    );
  });
});
