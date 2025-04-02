import { describe, expect, it, vi } from "vitest";
import { bffApi } from "pagopa-interop-api-clients";
import { getMockAuthData, getMockContext } from "pagopa-interop-commons-test";
import { AuthData, FileManager, userRoles } from "pagopa-interop-commons";
import { generateId } from "pagopa-interop-models";
import { agreementServiceBuilder } from "../src/services/agreementService.js";
import { PagoPAInteropBeClients } from "../src/clients/clientsProvider.js";
import { config } from "../src/config/config.js";
import { getBffMockContext } from "./utils.js";

describe("addAgreementConsumerDocument", () => {
  const agreementId = "test-agreement-id";
  const mockStoragePath = `${config.consumerDocumentsPath}/${agreementId}/mocked-uuid-1234-12-34`;

  const mockFile = new File(["test content"], "test.json", {
    type: "application/json",
  });

  const authData: AuthData = {
    ...getMockAuthData(),
    organizationId: generateId(),
    userRoles: [userRoles.ADMIN_ROLE],
  };

  it("should add agreement consumer document and store it", async () => {
    const arrayBufferMock = vi.fn().mockResolvedValue(new ArrayBuffer(10));
    const mockFileWithArrayBuffer = {
      ...mockFile,
      arrayBuffer: arrayBufferMock,
      name: "test.json",
      type: "application/json",
    };

    const enhancedMockDoc = {
      doc: mockFileWithArrayBuffer,
      name: "test.json",
      prettyName: "test.json",
    } as unknown as bffApi.addAgreementConsumerDocument_Body;

    const mockAddAgreementConsumerDocument = vi.fn().mockResolvedValue({});
    const mockStoreBytes = vi.fn().mockResolvedValue(mockStoragePath);

    const mockFileManager = {
      storeBytes: mockStoreBytes,
    } as unknown as FileManager;

    const mockClients = {
      agreementProcessClient: {
        addAgreementConsumerDocument: mockAddAgreementConsumerDocument,
      },
    } as unknown as PagoPAInteropBeClients;

    const agreementService = agreementServiceBuilder(
      mockClients,
      mockFileManager
    );

    const bffMockContext = getBffMockContext(getMockContext({ authData }));
    const result = await agreementService.addAgreementConsumerDocument(
      agreementId,
      enhancedMockDoc,
      bffMockContext
    );

    expect(arrayBufferMock).toHaveBeenCalled();

    expect(mockStoreBytes).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: config.consumerDocumentsContainer,
        path: `${config.consumerDocumentsPath}/${agreementId}`,
        resourceId: expect.any(String),
        name: "test.json",
        content: expect.any(Buffer),
      }),
      bffMockContext.logger
    );

    expect(result).toBeInstanceOf(Buffer);
  });
});
