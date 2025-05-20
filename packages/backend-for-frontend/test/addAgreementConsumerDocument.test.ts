import { describe, expect, it, vi } from "vitest";
import { bffApi } from "pagopa-interop-api-clients";
import { getMockAuthData, getMockContext } from "pagopa-interop-commons-test";
import { AuthData, userRole } from "pagopa-interop-commons";
import { generateId } from "pagopa-interop-models";
import { agreementServiceBuilder } from "../src/services/agreementService.js";
import { PagoPAInteropBeClients } from "../src/clients/clientsProvider.js";
import { config } from "../src/config/config.js";
import { fileManager, getBffMockContext } from "./integrationUtils.js";

describe("addAgreementConsumerDocument", () => {
  const agreementId = generateId();
  const mockFile = new File(["test content"], "test.json", {
    type: "application/json",
  });

  const authData: AuthData = {
    ...getMockAuthData(),
    organizationId: generateId(),
    userRoles: [userRole.ADMIN_ROLE],
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

    const mockClients = {
      agreementProcessClient: {
        addAgreementConsumerDocument: mockAddAgreementConsumerDocument,
      },
    } as unknown as PagoPAInteropBeClients;

    vi.spyOn(fileManager, "storeBytes");

    const agreementService = agreementServiceBuilder(mockClients, fileManager);

    const bffMockContext = getBffMockContext(getMockContext({ authData }));
    const result = await agreementService.addAgreementConsumerDocument(
      agreementId,
      enhancedMockDoc,
      bffMockContext
    );

    expect(arrayBufferMock).toHaveBeenCalled();

    expect(fileManager.storeBytes).toHaveBeenCalledWith(
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
