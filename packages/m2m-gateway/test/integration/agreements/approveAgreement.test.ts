import { beforeEach, describe, expect, it, vi } from "vitest";
import { agreementApi } from "pagopa-interop-api-clients";
import { unsafeBrandId } from "pagopa-interop-models";
import { getMockM2MAdminAppContext } from "pagopa-interop-commons-test/src/testUtils.js";
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
  agreementNotInPendingState,
  missingMetadata,
  resourcePollingTimeout,
} from "../../../src/model/errors.js";
import { getMockedApiAgreement } from "../../mockUtils.js";

describe("approveAgreement", () => {
  const mockAgreementProcessResponse = getMockedApiAgreement({
    state: agreementApi.AgreementState.Values.PENDING,
  });

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

    await agreementService.approveAgreement(
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

  it("Should throw agreementNotInPendingState in case of non-pending agreement", async () => {
    const mockAgreementNotPending = getMockedApiAgreement({ state: "ACTIVE" });
    mockGetAgreement.mockResolvedValueOnce(mockAgreementNotPending);

    await expect(
      agreementService.approveAgreement(
        unsafeBrandId(mockAgreementNotPending.data.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      agreementNotInPendingState(mockAgreementNotPending.data.id)
    );
  });

  it("Should throw missingMetadata in case the agreement returned by the unsuspend agreement POST call has no metadata", async () => {
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
    mockGetAgreement
      .mockResolvedValueOnce(mockAgreementProcessResponse)
      .mockResolvedValueOnce({
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
    // The activate will first get the agreement, then perform the polling
    mockGetAgreement
      .mockResolvedValueOnce(mockAgreementProcessResponse)
      .mockImplementation(
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
});
