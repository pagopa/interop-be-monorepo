import AdmZip from "adm-zip";
import { AxiosError, InternalAxiosRequestConfig } from "axios";
import fs from "fs";
import {
  agreementApi,
  attributeRegistryApi,
  bffApi,
  catalogApi,
  eserviceTemplateApi,
  inAppNotificationApi,
} from "pagopa-interop-api-clients";
import { genericLogger } from "pagopa-interop-commons";
import {
  createDummyStub,
  getMockAuthData,
  getMockContext,
  getMockDocument,
  getMockedPdfBuffer,
} from "pagopa-interop-commons-test";
import { AuthData } from "pagopa-interop-commons/";
import {
  DescriptorId,
  EServiceId,
  generateId,
  TenantId,
} from "pagopa-interop-models";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AuthorizationProcessClient,
  DelegationProcessClient,
  TenantProcessClient,
} from "../src/clients/clientsProvider.js";

import { config } from "../src/config/config.js";
import { invalidZipStructure } from "../src/model/errors.js";
import { catalogServiceBuilder } from "../src/services/catalogService.js";
import { fileManager, getBffMockContext } from "./utils.js";

describe("importEService", () => {
  const tenantId: TenantId = generateId<TenantId>();
  const baseEService: catalogApi.EService = {
    id: generateId<EServiceId>(),
    name: "mockEService",
    producerId: tenantId,
    description: "mockDescription",
    technology: "REST",
    descriptors: [
      {
        id: generateId<DescriptorId>(),
        version: "3.0.0",
        audience: [],
        voucherLifespan: 1,
        dailyCallsPerConsumer: 2,
        dailyCallsTotal: 2,
        docs: [],
        state: "PUBLISHED",
        agreementApprovalPolicy: "AUTOMATIC",
        serverUrls: [],
        interface: {
          id: "interface-id",
          name: "interface.yaml",
          path: "path/to/interface.yaml",
          contentType: "mockContentType",
          prettyName: "mockPrettyName",
          checksum: "mockChecksum",
          uploadDate: new Date().toISOString(),
        },
        attributes: {
          certified: [],
          verified: [],
          declared: [],
        },
      },
    ],
    mode: "RECEIVE",
    riskAnalysis: [],
  };

  const importEServiceResponse = {
    eservice: baseEService,
    createdDescriptorId: baseEService.descriptors[0].id,
  };

  const mockImportEService = vi.fn();

  const mockCatalogProcessClient = {
    importEService: mockImportEService,
  } as unknown as catalogApi.CatalogProcessClient;
  const mockTenantProcessClient = createDummyStub<TenantProcessClient>();
  const mockAgreementProcessClient =
    createDummyStub<agreementApi.AgreementProcessClient>();
  const mockAttributeProcessClient =
    createDummyStub<attributeRegistryApi.AttributeProcessClient>();
  const mockAuthorizationClient = createDummyStub<AuthorizationProcessClient>();
  const mockDelegationProcessClient =
    createDummyStub<DelegationProcessClient>();
  const mockEServiceTemplateProcessClient =
    createDummyStub<eserviceTemplateApi.EServiceTemplateProcessClient>();

  const mockInAppNotificationManagerClient =
    createDummyStub<inAppNotificationApi.InAppNotificationManagerClient>();

  const catalogService = catalogServiceBuilder(
    mockCatalogProcessClient,
    mockTenantProcessClient,
    mockAgreementProcessClient,
    mockAttributeProcessClient,
    mockAuthorizationClient,
    mockDelegationProcessClient,
    mockEServiceTemplateProcessClient,
    mockInAppNotificationManagerClient,
    fileManager,
    config
  );

  const fileResource: bffApi.FileResource = {
    filename: "test.zip",
    url: "/import/folder",
  };

  const zip = new AdmZip();
  const jsonFilename = "configuration.json";

  const configuration = {
    name: "Test EService",
    description: "Descrizione del test EService",
    technology: "REST",
    openapi: "3.0.0",
    servers: [{ url: "https://example.com" }],
    mode: "RECEIVE",
    descriptor: {
      description: "Descrizione del descriptor",
      audience: ["public"],
      voucherLifespan: 30,
      dailyCallsPerConsumer: 1000,
      dailyCallsTotal: 10000,
      agreementApprovalPolicy: "AUTOMATIC",
      docs: [],
      interface: { ...getMockDocument(), path: jsonFilename },
    },
    riskAnalysis: [],
    isSignalHubEnabled: false,
    isConsumerDelegable: false,
    isClientAccessDelegable: false,
  };
  zip.addFile(jsonFilename, Buffer.from(JSON.stringify(configuration)));

  const authData: AuthData = {
    ...getMockAuthData(),
    organizationId: tenantId,
  };
  const bffMockContext = getBffMockContext(getMockContext({ authData }));

  const firstDocFilename = "doc1.json";
  const secondDocFilename = "doc2.json";

  const configurationWithDocs = {
    ...configuration,
    descriptor: {
      ...configuration.descriptor,
      docs: [
        { ...getMockDocument(), path: firstDocFilename, prettyName: "first" },
        { ...getMockDocument(), path: secondDocFilename, prettyName: "second" },
      ],
    },
  };

  const badRequestAxiosError = (): AxiosError =>
    new AxiosError("Bad Request", "400", undefined, undefined, {
      status: 400,
      data: {},
      statusText: "Bad Request",
      config: {} as InternalAxiosRequestConfig,
      headers: {},
    });

  const storeImportZip = async (
    filename: string,
    zipConfiguration: { descriptor: { docs: Array<{ path: string }> } }
  ): Promise<{
    zipPath: string;
    importFileResource: bffApi.FileResource;
  }> => {
    const importZip = new AdmZip();
    importZip.addFile(
      jsonFilename,
      Buffer.from(JSON.stringify(zipConfiguration))
    );
    zipConfiguration.descriptor.docs.forEach((doc) =>
      importZip.addFile(doc.path, Buffer.from(JSON.stringify(doc)))
    );

    const zipPath = path.join(__dirname, filename);
    importZip.writeZip(zipPath);

    await fileManager.storeBytes(
      {
        bucket: config.importEserviceContainer,
        path: `${config.importEservicePath}`,
        resourceId: `${tenantId}`,
        name: filename,
        content: fs.readFileSync(zipPath),
      },
      genericLogger
    );

    return {
      zipPath,
      importFileResource: { filename, url: "/import/folder" },
    };
  };

  beforeEach(() => {
    // drop queued mockRejectedValueOnce values leaked by a failing test
    mockImportEService.mockReset();
    mockImportEService.mockResolvedValue(importEServiceResponse);
  });

  describe("success case", () => {
    it("should import eService from url", async () => {
      const zipPath = path.join(__dirname, "test.zip");
      zip.writeZip(zipPath);

      const zipContent = fs.readFileSync(zipPath);

      const storedBytes = await fileManager.storeBytes(
        {
          bucket: config.importEserviceContainer,
          path: `${config.importEservicePath}`,
          resourceId: `${tenantId}`,
          name: `${fileResource.filename}`,
          content: zipContent,
        },
        genericLogger
      );
      expect(storedBytes).toBe(
        `${config.importEservicePath}/${tenantId}/${fileResource.filename}`
      );

      const result = await catalogService.importEService(
        fileResource,
        bffMockContext
      );

      expect(result).toEqual({
        id: baseEService.id,
        descriptorId: baseEService.descriptors[0].id,
      });

      expect(mockImportEService).toHaveBeenCalledTimes(1);
      const [importSeed] = mockImportEService.mock.calls[0];
      expect(importSeed).toMatchObject({
        name: configuration.name,
        description: configuration.description,
        technology: "REST",
        mode: "RECEIVE",
        riskAnalysis: [],
        isSignalHubEnabled: false,
        isConsumerDelegable: false,
        isClientAccessDelegable: false,
        descriptor: {
          description: configuration.descriptor.description,
          audience: configuration.descriptor.audience,
          voucherLifespan: configuration.descriptor.voucherLifespan,
          dailyCallsPerConsumer: configuration.descriptor.dailyCallsPerConsumer,
          dailyCallsTotal: configuration.descriptor.dailyCallsTotal,
          agreementApprovalPolicy:
            configuration.descriptor.agreementApprovalPolicy,
          docs: [],
        },
      });
      expect(importSeed.descriptor.interface).toMatchObject({
        fileName: jsonFilename,
        contentType: "application/json",
        prettyName: configuration.descriptor.interface.prettyName,
        serverUrls: ["https://example.com"],
      });
      expect(importSeed.descriptor.interface.filePath).toContain(
        config.eserviceDocumentsPath
      );
      expect(importSeed.descriptor.interface.checksum).toBeDefined();
      expect(importSeed.eserviceId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );

      fs.unlinkSync(zipPath);
    });

    it("should import eService when the zip has a root folder whose name differs from the file name", async () => {
      const rootFolderName = "myRoot";
      const docPath = "documents/doc1.pdf";

      const configurationWithDoc = {
        ...configuration,
        descriptor: {
          ...configuration.descriptor,
          docs: [{ path: docPath, prettyName: "doc1 prettyName" }],
        },
      };

      const zipWithRootFolder = new AdmZip();
      zipWithRootFolder.addFile(
        `${rootFolderName}/${jsonFilename}`,
        Buffer.from(JSON.stringify(configurationWithDoc))
      );
      zipWithRootFolder.addFile(
        `${rootFolderName}/${docPath}`,
        getMockedPdfBuffer()
      );

      const renamedFileResource: bffApi.FileResource = {
        filename: "myRoot (1).zip",
        url: "/import/folder",
      };

      const zipPath = path.join(__dirname, "test_root.zip");
      zipWithRootFolder.writeZip(zipPath);

      const zipContent = fs.readFileSync(zipPath);

      await fileManager.storeBytes(
        {
          bucket: config.importEserviceContainer,
          path: `${config.importEservicePath}`,
          resourceId: `${tenantId}`,
          name: `${renamedFileResource.filename}`,
          content: zipContent,
        },
        genericLogger
      );

      const result = await catalogService.importEService(
        renamedFileResource,
        bffMockContext
      );

      expect(result).toEqual({
        id: baseEService.id,
        descriptorId: baseEService.descriptors[0].id,
      });

      expect(mockImportEService).toHaveBeenCalledTimes(1);
      const [importSeed] = mockImportEService.mock.calls[0];
      expect(importSeed.descriptor.docs).toHaveLength(1);
      expect(importSeed.descriptor.docs[0]).toMatchObject({
        fileName: docPath,
        prettyName: "doc1 prettyName",
        contentType: "application/pdf",
        serverUrls: [],
      });

      fs.unlinkSync(zipPath);
    });

    it("should convert the risk analyses of the configuration into the import seed", async () => {
      const configurationWithRiskAnalysis = {
        ...configuration,
        riskAnalysis: [
          {
            name: "test risk analysis",
            riskAnalysisForm: {
              version: "3.0",
              singleAnswers: [{ key: "purpose", value: "INSTITUTIONAL" }],
              multiAnswers: [
                { key: "personalDataTypes", values: ["OTHER", "GENERAL"] },
              ],
            },
          },
        ],
      };
      const { zipPath, importFileResource } = await storeImportZip(
        "test_risk_analysis.zip",
        configurationWithRiskAnalysis
      );

      try {
        await catalogService.importEService(importFileResource, bffMockContext);

        const [importSeed] = mockImportEService.mock.calls[0];
        expect(importSeed.riskAnalysis).toEqual([
          {
            name: "test risk analysis",
            riskAnalysisForm: {
              version: "3.0",
              answers: {
                purpose: ["INSTITUTIONAL"],
                personalDataTypes: ["OTHER", "GENERAL"],
              },
            },
          },
        ]);
      } finally {
        fs.unlinkSync(zipPath);
      }
    });
  });
  describe("error case", () => {
    it("should throw invalidZipStructure error when file name is not configuration.json", async () => {
      const zip = new AdmZip();
      const jsonFilename = "invalid_file.json";
      zip.addFile(jsonFilename, Buffer.from(JSON.stringify(configuration)));
      const zipPath = path.join(__dirname, "test.zip");
      zip.writeZip(zipPath);

      const zipContent = fs.readFileSync(zipPath);

      const storedBytes = await fileManager.storeBytes(
        {
          bucket: config.importEserviceContainer,
          path: `${config.importEservicePath}`,
          resourceId: `${tenantId}`,
          name: `${fileResource.filename}`,
          content: zipContent,
        },
        genericLogger
      );
      expect(storedBytes).toBe(
        `${config.importEservicePath}/${tenantId}/${fileResource.filename}`
      );

      await expect(
        catalogService.importEService(fileResource, bffMockContext)
      ).rejects.toThrowError(
        invalidZipStructure("Error reading configuration.json")
      );
      fs.unlinkSync(zipPath);
    });
    it("should throw invalidZipStructure when configuration.json is malformed", async () => {
      const malformedConfiguration = JSON.stringify({
        name: "Test EService",
      });

      const zip = new AdmZip();
      zip.addFile("configuration.json", Buffer.from(malformedConfiguration));
      const zipPath = path.join(__dirname, "test.zip");
      zip.writeZip(zipPath);

      const zipContent = fs.readFileSync(zipPath);

      const storedBytes = await fileManager.storeBytes(
        {
          bucket: config.importEserviceContainer,
          path: `${config.importEservicePath}`,
          resourceId: `${tenantId}`,
          name: `${fileResource.filename}`,
          content: zipContent,
        },
        genericLogger
      );
      expect(storedBytes).toBe(
        `${config.importEservicePath}/${tenantId}/${fileResource.filename}`
      );

      await expect(
        catalogService.importEService(fileResource, bffMockContext)
      ).rejects.toThrowError(
        invalidZipStructure("Error decoding configuration.json")
      );
      fs.unlinkSync(zipPath);
    });
    it("should should throw invalidZipStructure when some docs are undefined", async () => {
      const configuration = {
        name: "Test EService",
        description: "Descrizione del test EService",
        technology: "REST",
        openapi: "3.0.0",
        servers: [],
        mode: "RECEIVE",
        descriptor: {
          description: "Descrizione del descriptor",
          audience: ["public"],
          voucherLifespan: 30,
          dailyCallsPerConsumer: 1000,
          dailyCallsTotal: 10000,
          agreementApprovalPolicy: "AUTOMATIC",
          docs: [
            { path: "invalid path", prettyName: "invalid path prettyName" },
          ],
          interface: { ...getMockDocument(), path: jsonFilename },
        },
        riskAnalysis: [],
        isSignalHubEnabled: false,
        isConsumerDelegable: false,
        isClientAccessDelegable: false,
      };
      zip.addFile(jsonFilename, Buffer.from(JSON.stringify(configuration)));

      const zipPath = path.join(__dirname, "test.zip");
      zip.writeZip(zipPath);

      const zipContent = fs.readFileSync(zipPath);
      const storedBytes = await fileManager.storeBytes(
        {
          bucket: config.importEserviceContainer,
          path: `${config.importEservicePath}`,
          resourceId: `${tenantId}`,
          name: `${fileResource.filename}`,
          content: zipContent,
        },
        genericLogger
      );
      expect(storedBytes).toBe(
        `${config.importEservicePath}/${tenantId}/${fileResource.filename}`
      );

      await expect(
        catalogService.importEService(fileResource, bffMockContext)
      ).rejects.toThrowError(invalidZipStructure("Error reading docs"));
      fs.unlinkSync(zipPath);
    });
    it("should should throw invalidZipStructure when error during interface reading", async () => {
      const configuration = {
        name: "Test EService",
        description: "Descrizione del test EService",
        technology: "REST",
        openapi: "3.0.0",
        servers: [],
        mode: "RECEIVE",
        descriptor: {
          description: "Descrizione del descriptor",
          audience: ["public"],
          voucherLifespan: 30,
          dailyCallsPerConsumer: 1000,
          dailyCallsTotal: 10000,
          agreementApprovalPolicy: "AUTOMATIC",
          docs: [],
          interface: {
            ...getMockDocument(),
            path: "invalid interface path",
          },
        },
        riskAnalysis: [],
        isSignalHubEnabled: false,
        isConsumerDelegable: false,
        isClientAccessDelegable: false,
      };
      zip.addFile(jsonFilename, Buffer.from(JSON.stringify(configuration)));

      const zipPath = path.join(__dirname, "test.zip");
      zip.writeZip(zipPath);

      const zipContent = fs.readFileSync(zipPath);
      const storedBytes = await fileManager.storeBytes(
        {
          bucket: config.importEserviceContainer,
          path: `${config.importEservicePath}`,
          resourceId: `${tenantId}`,
          name: `${fileResource.filename}`,
          content: zipContent,
        },
        genericLogger
      );
      expect(storedBytes).toBe(
        `${config.importEservicePath}/${tenantId}/${fileResource.filename}`
      );

      await expect(
        catalogService.importEService(fileResource, bffMockContext)
      ).rejects.toThrowError(invalidZipStructure("Error reading interface"));
      fs.unlinkSync(zipPath);
    });
    it("should should throw invalidZipStructure when more than one file in zip is present", async () => {
      const secondFilename = "second file name";
      zip.addFile(jsonFilename, Buffer.from(JSON.stringify(configuration)));
      zip.addFile(secondFilename, Buffer.from("Second file"));

      const zipPath = path.join(__dirname, "test.zip");
      zip.writeZip(zipPath);

      const zipContent = fs.readFileSync(zipPath);
      const storedBytes = await fileManager.storeBytes(
        {
          bucket: config.importEserviceContainer,
          path: `${config.importEservicePath}`,
          resourceId: `${tenantId}`,
          name: `${fileResource.filename}`,
          content: zipContent,
        },
        genericLogger
      );
      expect(storedBytes).toBe(
        `${config.importEservicePath}/${tenantId}/${fileResource.filename}`
      );

      await expect(
        catalogService.importEService(fileResource, bffMockContext)
      ).rejects.toThrowError(
        invalidZipStructure(`Not allowed files found: ${secondFilename}`)
      );
      fs.unlinkSync(zipPath);
    });
    it("should delete the uploaded documents and re-throw the error when the catalog-process import call fails", async () => {
      const zipWithInterface = new AdmZip();
      zipWithInterface.addFile(
        jsonFilename,
        Buffer.from(JSON.stringify(configuration))
      );

      const zipPath = path.join(__dirname, "test_ra.zip");
      zipWithInterface.writeZip(zipPath);

      const zipContent = fs.readFileSync(zipPath);

      const importFileResource: bffApi.FileResource = {
        filename: "test_ra.zip",
        url: "/import/folder",
      };

      await fileManager.storeBytes(
        {
          bucket: config.importEserviceContainer,
          path: `${config.importEservicePath}`,
          resourceId: `${tenantId}`,
          name: `${importFileResource.filename}`,
          content: zipContent,
        },
        genericLogger
      );

      const importError = new AxiosError(
        "Risk analysis validation failed",
        "400",
        undefined,
        undefined,
        {
          status: 400,
          data: {
            type: "about:blank",
            title: "Risk analysis validation failed",
            status: 400,
            detail:
              "Risk analysis validation failed. Reasons: [Ruleset version 1.0 for tenant kind GSP has expired]",
            correlationId: "test-correlation-id",
            errors: [
              {
                code: "001-0019",
                detail:
                  "Risk analysis validation failed. Reasons: [Ruleset version 1.0 for tenant kind GSP has expired]",
              },
            ],
          },
          statusText: "Bad Request",
          config: {} as InternalAxiosRequestConfig,
          headers: {},
        }
      );

      mockImportEService.mockRejectedValueOnce(importError);
      const deleteSpy = vi.spyOn(fileManager, "delete");

      try {
        await expect(
          catalogService.importEService(importFileResource, bffMockContext)
        ).rejects.toThrowError(importError);

        expect(deleteSpy).toHaveBeenCalledTimes(1);
        const [deletedContainer, deletedPath] = deleteSpy.mock.calls[0];
        expect(deletedContainer).toBe(config.eserviceDocumentsContainer);
        expect(deletedPath).toContain(config.eserviceDocumentsPath);
        expect(deletedPath).toContain(jsonFilename);
      } finally {
        deleteSpy.mockRestore();
        fs.unlinkSync(zipPath);
      }
    });

    it("should delete every uploaded document when the import fails after an interface and multiple docs were uploaded", async () => {
      const { zipPath, importFileResource } = await storeImportZip(
        "test_multi_docs.zip",
        configurationWithDocs
      );

      const importError = badRequestAxiosError();
      mockImportEService.mockRejectedValueOnce(importError);
      const deleteSpy = vi.spyOn(fileManager, "delete");

      try {
        await expect(
          catalogService.importEService(importFileResource, bffMockContext)
        ).rejects.toThrowError(importError);

        expect(deleteSpy).toHaveBeenCalledTimes(3);
        const deletedPaths = deleteSpy.mock.calls.map(([, path]) => path);
        expect(deletedPaths.some((p) => p.includes(jsonFilename))).toBe(true);
        expect(deletedPaths.some((p) => p.includes(firstDocFilename))).toBe(
          true
        );
        expect(deletedPaths.some((p) => p.includes(secondDocFilename))).toBe(
          true
        );
      } finally {
        deleteSpy.mockRestore();
        fs.unlinkSync(zipPath);
      }
    });

    it("should delete the already uploaded documents when a later document fails to upload before the catalog-process call", async () => {
      const { zipPath, importFileResource } = await storeImportZip(
        "test_late_failure.zip",
        configurationWithDocs
      );

      const deleteSpy = vi.spyOn(fileManager, "delete");
      // captured before spying, otherwise the passthrough would recurse
      const storeBytes = fileManager.storeBytes.bind(fileManager);
      const storeBytesSpy = vi
        .spyOn(fileManager, "storeBytes")
        .mockImplementationOnce(storeBytes)
        .mockImplementationOnce(storeBytes)
        .mockRejectedValueOnce(new Error("storeBytes failed"));

      try {
        await expect(
          catalogService.importEService(importFileResource, bffMockContext)
        ).rejects.toThrowError("storeBytes failed");

        // the interface and the first doc were uploaded before the failure
        expect(deleteSpy).toHaveBeenCalledTimes(2);
        expect(mockImportEService).not.toHaveBeenCalled();
      } finally {
        storeBytesSpy.mockRestore();
        deleteSpy.mockRestore();
        fs.unlinkSync(zipPath);
      }
    });

    it("should keep the uploaded documents when the catalog-process call fails without a response", async () => {
      const { zipPath, importFileResource } = await storeImportZip(
        "test_no_response.zip",
        configuration
      );

      const networkError = new AxiosError("socket hang up", "ECONNRESET");
      mockImportEService.mockRejectedValueOnce(networkError);
      const deleteSpy = vi.spyOn(fileManager, "delete");

      try {
        await expect(
          catalogService.importEService(importFileResource, bffMockContext)
        ).rejects.toThrowError(networkError);

        expect(deleteSpy).not.toHaveBeenCalled();
      } finally {
        deleteSpy.mockRestore();
        fs.unlinkSync(zipPath);
      }
    });

    it("should keep the uploaded documents when the catalog-process call fails with a 5xx", async () => {
      const { zipPath, importFileResource } = await storeImportZip(
        "test_gateway_timeout.zip",
        configuration
      );

      const gatewayTimeout = new AxiosError(
        "Gateway Timeout",
        "504",
        undefined,
        undefined,
        {
          status: 504,
          data: {},
          statusText: "Gateway Timeout",
          config: {} as InternalAxiosRequestConfig,
          headers: {},
        }
      );
      mockImportEService.mockRejectedValueOnce(gatewayTimeout);
      const deleteSpy = vi.spyOn(fileManager, "delete");

      try {
        await expect(
          catalogService.importEService(importFileResource, bffMockContext)
        ).rejects.toThrowError(gatewayTimeout);

        expect(deleteSpy).not.toHaveBeenCalled();
      } finally {
        deleteSpy.mockRestore();
        fs.unlinkSync(zipPath);
      }
    });

    it("should keep the uploaded documents when the import call succeeds but the response cannot be read", async () => {
      const { zipPath, importFileResource } = await storeImportZip(
        "test_unreadable_response.zip",
        configuration
      );

      // a malformed 200 body throws after the commit: keep the files
      mockImportEService.mockResolvedValueOnce(undefined);
      const deleteSpy = vi.spyOn(fileManager, "delete");

      try {
        await expect(
          catalogService.importEService(importFileResource, bffMockContext)
        ).rejects.toThrowError(TypeError);

        expect(deleteSpy).not.toHaveBeenCalled();
      } finally {
        deleteSpy.mockRestore();
        fs.unlinkSync(zipPath);
      }
    });
  });
});
