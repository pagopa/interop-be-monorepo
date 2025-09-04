import { beforeEach, describe, expect, it, vi } from "vitest";
import { agreementApi } from "pagopa-interop-api-clients";
import {
  generateId,
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
  agreementNotInPendingState,
  missingMetadata,
} from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("approveAgreement", () => {
  const mockAgreementProcessResponse = getMockWithMetadata(
    getMockedApiAgreement({
      state: agreementApi.AgreementState.Values.PENDING,
    })
  );

  const mockDelegationRef = { delegationId: generateId() };

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

  mockInteropBeClients.delegationProcessClient = {
    delegation: {
      getDelegations: vi
        .fn()
        .mockResolvedValue(getMockWithMetadata({ results: [] })),
    },
  } as unknown as PagoPAInteropBeClients["delegationProcessClient"];

  beforeEach(() => {
    mockActivateAgreement.mockClear();
    mockGetAgreement.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    mockGetAgreement.mockResolvedValueOnce(mockAgreementProcessResponse);

    await agreementService.approveAgreement(
      unsafeBrandId(mockAgreementProcessResponse.data.id),
      mockDelegationRef,
      getMockM2MAdminAppContext()
    );

    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.agreementProcessClient.activateAgreement,
      params: {
        agreementId: mockAgreementProcessResponse.data.id,
      },
      body: mockDelegationRef,
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
    const mockAgreementNotPending = getMockWithMetadata(
      getMockedApiAgreement({ state: "ACTIVE" })
    );
    mockGetAgreement.mockResolvedValueOnce(mockAgreementNotPending);

    await expect(
      agreementService.approveAgreement(
        unsafeBrandId(mockAgreementNotPending.data.id),
        mockDelegationRef,
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
        mockDelegationRef,
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
        mockDelegationRef,
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
      agreementService.approveAgreement(
        unsafeBrandId(mockAgreementProcessResponse.data.id),
        mockDelegationRef,
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
