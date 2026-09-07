import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EServiceTemplateVersionId,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiEServiceTemplate,
  getMockedApiEserviceTemplateVersion,
  getMockedApiEserviceDoc,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { genericLogger } from "pagopa-interop-commons";
import {
  eserviceTemplateService,
  expectApiClientGetToHaveBeenCalledWith,
  fileManager,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import {
  eserviceTemplateVersionInterfaceNotFound,
  eserviceTemplateVersionNotFound,
} from "../../../src/model/errors.js";
import { config } from "../../../src/config/config.js";
import { expectDownloadedDocumentToBeEqual } from "../../multipartTestUtils.js";

describe("downloadEServiceTemplateVersionInterface", () => {
  const testFileContent =
    "This is a mock file content for testing purposes.\nOn multiple lines.";

  const mockInterfaceId = generateId();
  const mockInterfaceName = "interfaceDoc.txt";
  const mockInterface = getMockedApiEserviceDoc({
    id: mockInterfaceId,
    name: mockInterfaceName,
    path: `${config.eserviceTemplateDocumentsPath}/${mockInterfaceId}/${mockInterfaceName}`,
  });
  const mockEserviceTemplateProcessResponseVersion = {
    ...getMockedApiEserviceTemplateVersion(),
    interface: mockInterface,
  };

  const mockEserviceTemplateProcessResponse = getMockWithMetadata(
    getMockedApiEServiceTemplate({
      versions: [
        mockEserviceTemplateProcessResponseVersion,
        getMockedApiEserviceTemplateVersion(),
      ],
    })
  );
  const mockGetEserviceTemplate = vi
    .fn()
    .mockResolvedValue(mockEserviceTemplateProcessResponse);

  mockInteropBeClients.eserviceTemplateProcessClient = {
    getEServiceTemplateById: mockGetEserviceTemplate,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetEserviceTemplate.mockClear();
  });

  it("Should succeed, perform API clients calls, and retrieve the file", async () => {
    await fileManager.storeBytes(
      {
        bucket: config.eserviceTemplateDocumentsContainer,
        path: config.eserviceTemplateDocumentsPath,
        resourceId: mockInterface.id,
        name: mockInterface.name,
        content: Buffer.from(testFileContent),
      },
      genericLogger
    );

    expect(
      (
        await fileManager.listFiles(
          config.eserviceTemplateDocumentsContainer,
          genericLogger
        )
      ).at(0)
    ).toStrictEqual(mockInterface.path);

    const result =
      await eserviceTemplateService.downloadEServiceTemplateVersionInterface(
        unsafeBrandId(mockEserviceTemplateProcessResponse.data.id),
        unsafeBrandId(mockEserviceTemplateProcessResponseVersion.id),
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
      mockGet:
        mockInteropBeClients.eserviceTemplateProcessClient
          .getEServiceTemplateById,
      params: { templateId: mockEserviceTemplateProcessResponse.data.id },
    });
  });

  it("Should throw eserviceTemplateVersionNotFound in case the returned eservice template has no version with the given id", async () => {
    const nonExistingVersionId = generateId<EServiceTemplateVersionId>();
    await expect(
      eserviceTemplateService.downloadEServiceTemplateVersionInterface(
        unsafeBrandId(mockEserviceTemplateProcessResponse.data.id),
        nonExistingVersionId,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceTemplateVersionNotFound(
        unsafeBrandId(mockEserviceTemplateProcessResponse.data.id),
        nonExistingVersionId
      )
    );
  });

  it("Should throw eserviceTemplateVersionInterfaceNotFound in case the returned eservice template version has no interface", async () => {
    mockGetEserviceTemplate.mockResolvedValueOnce({
      ...mockEserviceTemplateProcessResponse,
      data: {
        ...mockEserviceTemplateProcessResponse.data,
        versions: [
          {
            ...mockEserviceTemplateProcessResponseVersion,
            interface: undefined,
          },
        ],
      },
    });
    await expect(
      eserviceTemplateService.downloadEServiceTemplateVersionInterface(
        unsafeBrandId(mockEserviceTemplateProcessResponse.data.id),
        unsafeBrandId(mockEserviceTemplateProcessResponseVersion.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceTemplateVersionInterfaceNotFound(
        unsafeBrandId(mockEserviceTemplateProcessResponse.data.id),
        unsafeBrandId(mockEserviceTemplateProcessResponseVersion.id)
      )
    );
  });
});
