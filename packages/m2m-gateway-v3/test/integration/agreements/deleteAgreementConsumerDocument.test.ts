import { describe, it, vi, beforeEach, expect } from "vitest";
import {
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockWithMetadata,
  getMockedApiAgreement,
  getMockedApiAgreementDocument,
} from "pagopa-interop-commons-test";
import {
  agreementService,
  expectApiClientPostToHaveBeenCalledWith,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { config } from "../../../src/config/config.js";

describe("deleteAgreementConsumerDocument", () => {
  const mockDocument = getMockedApiAgreementDocument();
  const mockAgreement = getMockedApiAgreement({
    consumerDocuments: [mockDocument],
  });
  const mockRemoveResponse = { metadata: { version: 2 } };
  const mockGetAgreementResponse = getMockWithMetadata(mockAgreement, 2);

  const mockDeleteAgreementConsumerDocument = vi
    .fn()
    .mockResolvedValue(mockRemoveResponse);
  const mockGetAgreement = vi.fn(
    mockPollingResponse(mockGetAgreementResponse, 2)
  );

  mockInteropBeClients.agreementProcessClient = {
    removeAgreementConsumerDocument: mockDeleteAgreementConsumerDocument,
    getAgreementById: mockGetAgreement,
  } as unknown as PagoPAInteropBeClients["agreementProcessClient"];

  beforeEach(() => {
    mockDeleteAgreementConsumerDocument.mockClear();
    mockGetAgreement.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    await agreementService.deleteAgreementConsumerDocument(
      unsafeBrandId(mockAgreement.id),
      unsafeBrandId(mockDocument.id),
      getMockM2MAdminAppContext()
    );
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.agreementProcessClient
          .removeAgreementConsumerDocument,
      params: { agreementId: mockAgreement.id, documentId: mockDocument.id },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.agreementProcessClient.getAgreementById,
      params: { agreementId: mockAgreement.id },
    });
  });

  it("Should throw missingMetadata in case the agreement returned by the document DELETE call has no metadata", async () => {
    mockDeleteAgreementConsumerDocument.mockResolvedValueOnce({
      ...mockGetAgreementResponse,
      metadata: undefined,
    });

    await expect(
      agreementService.deleteAgreementConsumerDocument(
        unsafeBrandId(mockAgreement.id),
        unsafeBrandId(mockDocument.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the agreement returned by the polling GET call has no metadata", async () => {
    mockGetAgreement.mockResolvedValueOnce({
      ...mockGetAgreementResponse,
      metadata: undefined,
    });

    await expect(
      agreementService.deleteAgreementConsumerDocument(
        unsafeBrandId(mockAgreement.id),
        unsafeBrandId(mockDocument.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetAgreement.mockImplementation(
      mockPollingResponse(
        mockGetAgreementResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      agreementService.deleteAgreementConsumerDocument(
        unsafeBrandId(mockGetAgreementResponse.data.id),
        unsafeBrandId(mockGetAgreementResponse.data.consumerDocuments[0].id),
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
