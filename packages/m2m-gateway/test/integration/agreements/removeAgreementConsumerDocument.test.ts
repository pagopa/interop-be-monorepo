import { describe, it, vi, beforeEach } from "vitest";
import { unsafeBrandId } from "pagopa-interop-models";
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

describe("removeAgreementConsumerDocument", () => {
  const mockDocument = getMockedApiAgreementDocument();
  const mockAgreement = getMockedApiAgreement({
    consumerDocuments: [mockDocument],
  });
  const mockRemoveResponse = { metadata: { version: 2 } };
  const mockGetAgreementResponse = getMockWithMetadata(mockAgreement, 2);

  const mockRemoveAgreementConsumerDocument = vi
    .fn()
    .mockResolvedValue(mockRemoveResponse);
  const mockGetAgreement = vi.fn(
    mockPollingResponse(mockGetAgreementResponse, 2)
  );

  mockInteropBeClients.agreementProcessClient = {
    removeAgreementConsumerDocument: mockRemoveAgreementConsumerDocument,
    getAgreementById: mockGetAgreement,
  } as unknown as PagoPAInteropBeClients["agreementProcessClient"];

  beforeEach(() => {
    mockRemoveAgreementConsumerDocument.mockClear();
    mockGetAgreement.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    await agreementService.removeAgreementConsumerDocument(
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
});
