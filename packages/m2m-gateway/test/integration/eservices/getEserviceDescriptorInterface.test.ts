import { describe, it, expect, vi, beforeEach } from "vitest";
import { DescriptorId, generateId, unsafeBrandId } from "pagopa-interop-models";
import {
  getMockedApiEservice,
  getMockedApiEserviceDescriptor,
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

describe("getEserviceDescriptor", () => {
  const testFileContent = `This is a mock file content for testing purposes.
It simulates the content of an Eservice descriptor interface file.
On multiple lines.`;

  const mockInterfaceId = generateId();
  const mockInterfaceName = "interfaceDoc.txt";
  const mockInterface = {
    id: mockInterfaceId,
    name: mockInterfaceName,
    contentType: "text/plain",
    prettyName: "Interface Document",
    path: `${config.eserviceDocumentsPath}/${mockInterfaceId}/${mockInterfaceName}`,
    checksum: "mock-checksum",
  };
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

    const result = await eserviceService.getEServiceDescriptorInterface(
      unsafeBrandId(mockCatalogProcessResponse.data.id),
      unsafeBrandId(mockCatalogProcessResponseDescriptor.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual({
      file: Buffer.from(testFileContent),
      contentType: mockInterface.contentType,
      filename: mockInterface.prettyName,
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: mockCatalogProcessResponse.data.id },
    });
  });

  it("Should throw eserviceDescriptorNotFound in case the returned eservice has no descriptor with the given id", async () => {
    const nonExistingDescriptorId = generateId<DescriptorId>();
    await expect(
      eserviceService.getEServiceDescriptorInterface(
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
      eserviceService.getEServiceDescriptorInterface(
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
