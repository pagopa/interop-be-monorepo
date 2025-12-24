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
  eserviceDescriptorInterfaceNotFound,
  eserviceDescriptorNotFound,
} from "../../../src/model/errors.js";
import { config } from "../../../src/config/config.js";
import { expectDownloadedDocumentToBeEqual } from "../../multipartTestUtils.js";

describe("downloadEServiceDescriptorInterface", () => {
  const testFileContent =
    "This is a mock file content for testing purposes.\nOn multiple lines.";

  const mockInterfaceId = generateId();
  const mockInterfaceName = "interfaceDoc.txt";
  const mockInterface = getMockedApiEserviceDoc({
    id: mockInterfaceId,
    name: mockInterfaceName,
    path: `${config.eserviceDocumentsPath}/${mockInterfaceId}/${mockInterfaceName}`,
  });
  const mockCatalogProcessResponseDescriptor = getMockedApiEserviceDescriptor({
    interfaceDoc: mockInterface,
  });

  const mockCatalogProcessResponse = getMockWithMetadata(
    getMockedApiEservice({
      descriptors: [
        mockCatalogProcessResponseDescriptor,
        getMockedApiEserviceDescriptor(),
      ],
    })
  );
  const mockGetEservice = vi.fn().mockResolvedValue(mockCatalogProcessResponse);

  mockInteropBeClients.catalogProcessClient = {
    getEServiceById: mockGetEservice,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetEservice.mockClear();
  });

  it("Should succeed, perform API clients calls, and retrieve the file", async () => {
    await fileManager.storeBytes(
      {
        bucket: config.eserviceDocumentsContainer,
        path: config.eserviceDocumentsPath,
        resourceId: mockInterface.id,
        name: mockInterface.name,
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
    ).toEqual(mockInterface.path);

    const result = await eserviceService.downloadEServiceDescriptorInterface(
      unsafeBrandId(mockCatalogProcessResponse.data.id),
      unsafeBrandId(mockCatalogProcessResponseDescriptor.id),
      getMockM2MAdminAppContext()
    );

    const expectedServiceResponse = {
      id: mockInterface.id,
      file: new File([Buffer.from(testFileContent)], mockInterface.name, {
        type: mockInterface.contentType,
      }),
      prettyName: mockInterface.prettyName,
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
      eserviceService.downloadEServiceDescriptorInterface(
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

  it("Should throw eserviceDescriptorInterfaceNotFound in case the returned eservice descriptor has no interface", async () => {
    mockGetEservice.mockResolvedValueOnce({
      ...mockCatalogProcessResponse,
      data: {
        ...mockCatalogProcessResponse.data,
        descriptors: [
          {
            ...mockCatalogProcessResponseDescriptor,
            interface: undefined,
          },
        ],
      },
    });
    await expect(
      eserviceService.downloadEServiceDescriptorInterface(
        unsafeBrandId(mockCatalogProcessResponse.data.id),
        unsafeBrandId(mockCatalogProcessResponseDescriptor.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceDescriptorInterfaceNotFound(
        mockCatalogProcessResponse.data.id,
        mockCatalogProcessResponseDescriptor.id
      )
    );
  });
});
