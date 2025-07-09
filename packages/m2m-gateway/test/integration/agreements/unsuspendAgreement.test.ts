import { beforeEach, describe, expect, it, vi } from "vitest";
import { agreementApi } from "pagopa-interop-api-clients";
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
import {
  agreementNotInSuspendedState,
  missingMetadata,
} from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("unsuspendAgreement", () => {
  const mockAgreementProcessResponse = getMockWithMetadata(
    getMockedApiAgreement({
      state: agreementApi.AgreementState.Values.SUSPENDED,
    })
  );

  const pollingTentatives = 2;
  const mockActivateAgreement = vi
    .fn()
    .mockResolvedValue(mockAgreementProcessResponse);
  const mockGetAgreement = vi.fn(
    mockPollingResponse(mockAgreementProcessResponse, pollingTentatives)
  );

  mockInteropBeClients.agreementProcessClient = {
    getAgreementById: mockGetAgreement,
    activateAgreement: mockActivateAgreement,
  } as unknown as PagoPAInteropBeClients["agreementProcessClient"];

  beforeEach(() => {
    mockActivateAgreement.mockClear();
    mockGetAgreement.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    mockGetAgreement.mockResolvedValueOnce(mockAgreementProcessResponse);

    await agreementService.unsuspendAgreement(
      unsafeBrandId(mockAgreementProcessResponse.data.id),
      getMockM2MAdminAppContext()
    );

    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.agreementProcessClient.activateAgreement,
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
    ).toHaveBeenCalledTimes(pollingTentatives + 1);
  });

  it("Should throw agreementNotInSuspendedState in case of non-suspended agreement", async () => {
    const mockAgreementNotSuspended = getMockWithMetadata(
      getMockedApiAgreement({
        state: agreementApi.AgreementState.Values.ACTIVE,
      })
    );
    mockGetAgreement.mockResolvedValueOnce(mockAgreementNotSuspended);

    await expect(
      agreementService.unsuspendAgreement(
        unsafeBrandId(mockAgreementNotSuspended.data.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      agreementNotInSuspendedState(mockAgreementNotSuspended.data.id)
    );
  });

  it("Should throw missingMetadata in case the agreement returned by the unsuspend agreement POST call has no metadata", async () => {
    mockGetAgreement.mockResolvedValueOnce(mockAgreementProcessResponse);
    mockActivateAgreement.mockResolvedValueOnce({
      ...mockAgreementProcessResponse,
      metadata: undefined,
    });

    await expect(
      agreementService.unsuspendAgreement(
        unsafeBrandId(mockAgreementProcessResponse.data.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the agreement returned by the polling GET call has no metadata", async () => {
    mockGetAgreement
      .mockResolvedValueOnce(mockAgreementProcessResponse)
      .mockResolvedValueOnce({
        ...mockAgreementProcessResponse,
        metadata: undefined,
      });

    await expect(
      agreementService.unsuspendAgreement(
        unsafeBrandId(mockAgreementProcessResponse.data.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    // The activate will first get the agreement, then perform the polling
    mockGetAgreement
      .mockResolvedValueOnce(mockAgreementProcessResponse)
      .mockImplementation(
        mockPollingResponse(
          mockAgreementProcessResponse,
          config.defaultPollingMaxRetries + 1
        )
      );

    await expect(
      agreementService.unsuspendAgreement(
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
      config.defaultPollingMaxRetries + 1
    );
  });
});
