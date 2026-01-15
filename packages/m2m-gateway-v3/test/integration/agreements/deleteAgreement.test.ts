import { describe, it, expect, vi, beforeEach } from "vitest";
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
  mockDeletionPollingResponse,
  mockInteropBeClients,
  agreementService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { config } from "../../../src/config/config.js";

describe("deleteAgreement", () => {
  const mockApiAgreement = getMockWithMetadata(getMockedApiAgreement());

  const mockDeleteAgreement = vi.fn();
  const mockGetAgreement = vi.fn(
    mockDeletionPollingResponse(mockApiAgreement, 2)
  );

  mockInteropBeClients.agreementProcessClient = {
    getAgreementById: mockGetAgreement,
    deleteAgreement: mockDeleteAgreement,
  } as unknown as PagoPAInteropBeClients["agreementProcessClient"];

  beforeEach(() => {
    mockDeleteAgreement.mockClear();
    mockGetAgreement.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    await agreementService.deleteAgreementById(
      unsafeBrandId(mockApiAgreement.data.id),
      getMockM2MAdminAppContext()
    );

    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.agreementProcessClient.deleteAgreement,
      params: { agreementId: mockApiAgreement.data.id },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.agreementProcessClient.getAgreementById,
      params: { agreementId: mockApiAgreement.data.id },
    });
    expect(
      mockInteropBeClients.agreementProcessClient.getAgreementById
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetAgreement.mockImplementation(
      mockDeletionPollingResponse(
        mockApiAgreement,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      agreementService.deleteAgreementById(
        unsafeBrandId(mockApiAgreement.data.id),
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
