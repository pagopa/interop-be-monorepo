import { describe, it, expect, vi, beforeEach } from "vitest";
import { DescriptorId, generateId, unsafeBrandId } from "pagopa-interop-models";
import {
  getMockedApiEservice,
  getMockedApiEserviceDescriptor,
  getMockedApiEserviceDoc,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { genericLogger } from "pagopa-interop-commons";
import {
  eserviceService,
  expectApiClientGetToHaveBeenCalledWith,
  fileManager,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import {
  eserviceDescriptorAsyncExchangeCallbackInterfaceNotFound,
  eserviceDescriptorNotFound,
} from "../../../src/model/errors.js";
import { config } from "../../../src/config/config.js";
import { expectDownloadedDocumentToBeEqual } from "../../multipartTestUtils.js";

describe("downloadEServiceDescriptorAsyncExchangeCallbackInterface", () => {
  const testFileContent =
    "This is a mock file content for testing purposes.\nOn multiple lines.";

  const mockCallbackInterfaceId = generateId();
  const mockCallbackInterfaceName = "callbackInterfaceDoc.txt";
  const mockCallbackInterface = getMockedApiEserviceDoc({
    id: mockCallbackInterfaceId,
    name: mockCallbackInterfaceName,
    path: `${config.eserviceDocumentsPath}/${mockCallbackInterfaceId}/${mockCallbackInterfaceName}`,
  });
  const mockCatalogProcessResponseDescriptor = getMockedApiEserviceDescriptor({
    interfaceDoc: getMockedApiEserviceDoc(),
  });
  // Add asyncExchangeCallbackInterface to the descriptor
  const descriptorWithCallbackInterface = {
    ...mockCatalogProcessResponseDescriptor,
    asyncExchangeCallbackInterface: mockCallbackInterface,
  };

  const mockCatalogProcessResponse = getMockWithMetadata(
    getMockedApiEservice({
      descriptors: [
        descriptorWithCallbackInterface,
        getMockedApiEserviceDescriptor(),
      ],
    })
  );
  const mockGetEservice = vi.fn().mockResolvedValue(mockCatalogProcessResponse);

  mockInteropBeClients.catalogProcessClient = {
    getEServiceById: mockGetEservice,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockGetEservice.mockClear();
  });

  it("Should succeed, perform API clients calls, and retrieve the file", async () => {
    await fileManager.storeBytes(
      {
        bucket: config.eserviceDocumentsContainer,
        path: config.eserviceDocumentsPath,
        resourceId: mockCallbackInterface.id,
        name: mockCallbackInterface.name,
        content: Buffer.from(testFileContent),
      },
      genericLogger
    );

    expect(
      (
        await fileManager.listFiles(
          config.eserviceDocumentsContainer,
          genericLogger
        )
      ).at(0)
    ).toStrictEqual(mockCallbackInterface.path);

    const result =
      await eserviceService.downloadEServiceDescriptorAsyncExchangeCallbackInterface(
        unsafeBrandId(mockCatalogProcessResponse.data.id),
        unsafeBrandId(descriptorWithCallbackInterface.id),
        getMockM2MAdminAppContext()
      );

    const expectedServiceResponse = {
      id: mockCallbackInterface.id,
      file: new File(
        [Buffer.from(testFileContent)],
        mockCallbackInterface.name,
        {
          type: mockCallbackInterface.contentType,
        }
      ),
      prettyName: mockCallbackInterface.prettyName,
    };
    await expectDownloadedDocumentToBeEqual(result, expectedServiceResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: mockCatalogProcessResponse.data.id },
    });
  });

  it("Should throw eserviceDescriptorNotFound in case the returned eservice has no descriptor with the given id", async () => {
    const nonExistingDescriptorId = generateId<DescriptorId>();
    await expect(
      eserviceService.downloadEServiceDescriptorAsyncExchangeCallbackInterface(
        unsafeBrandId(mockCatalogProcessResponse.data.id),
        nonExistingDescriptorId,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceDescriptorNotFound(
        mockCatalogProcessResponse.data.id,
        nonExistingDescriptorId
      )
    );
  });

  it("Should throw eserviceDescriptorAsyncExchangeCallbackInterfaceNotFound in case the returned eservice descriptor has no async exchange callback interface", async () => {
    mockGetEservice.mockResolvedValueOnce({
      ...mockCatalogProcessResponse,
      data: {
        ...mockCatalogProcessResponse.data,
        descriptors: [
          {
            ...descriptorWithCallbackInterface,
            asyncExchangeCallbackInterface: undefined,
          },
        ],
      },
    });
    await expect(
      eserviceService.downloadEServiceDescriptorAsyncExchangeCallbackInterface(
        unsafeBrandId(mockCatalogProcessResponse.data.id),
        unsafeBrandId(descriptorWithCallbackInterface.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceDescriptorAsyncExchangeCallbackInterfaceNotFound(
        mockCatalogProcessResponse.data.id,
        descriptorWithCallbackInterface.id
      )
    );
  });
});
