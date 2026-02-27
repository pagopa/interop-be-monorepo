import path from "path";
import fs from "fs";
import { describe, expect, it, vi } from "vitest";
import { AuthData } from "pagopa-interop-commons/";
import {
  createDummyStub,
  getMockAuthData,
  getMockContext,
  getMockDocument,
} from "pagopa-interop-commons-test";
import {
  DescriptorId,
  EServiceId,
  generateId,
  TenantId,
} from "pagopa-interop-models";
import {
  agreementApi,
  attributeRegistryApi,
  bffApi,
  catalogApi,
  eserviceTemplateApi,
  inAppNotificationApi,
} from "pagopa-interop-api-clients";
import { genericLogger } from "pagopa-interop-commons";
import AdmZip from "adm-zip";
import * as apiUtils from "pagopa-interop-commons";
import type {
  DelegationProcessClient,
  TenantProcessClient,
} from "../src/clients/clientsProvider.js";
import { catalogServiceBuilder } from "../src/services/catalogService.js";
import { config } from "../src/config/config.js";
import { invalidZipStructure } from "../src/model/errors.js";
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

  const mockCatalogProcessClient = {
    createEService: vi.fn().mockResolvedValue(baseEService),
    getEServiceById: vi.fn().mockResolvedValue(baseEService),
    createEServiceDocument: vi.fn().mockResolvedValue(getMockDocument()),
  } as unknown as catalogApi.CatalogProcessClient;
  const mockTenantProcessClient = createDummyStub<TenantProcessClient>();
  const mockAgreementProcessClient =
    createDummyStub<agreementApi.AgreementProcessClient>();
  const mockAttributeProcessClient =
    createDummyStub<attributeRegistryApi.AttributeProcessClient>();
  const mockDelegationProcessClient =
    createDummyStub<DelegationProcessClient>();
  const mockEServiceTemplateProcessClient =
    createDummyStub<eserviceTemplateApi.EServiceTemplateProcessClient>();

  const mockInAppNotificationManagerClient =
    createDummyStub<inAppNotificationApi.InAppNotificationManagerClient>();

  const mockPollingFunction = vi.fn(() => Promise.resolve());
  vi.spyOn(apiUtils, "createPollingByCondition").mockImplementation(
    () => mockPollingFunction
  );

  const catalogService = catalogServiceBuilder(
    mockCatalogProcessClient,
    mockTenantProcessClient,
    mockAgreementProcessClient,
    mockAttributeProcessClient,
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
      fs.unlinkSync(zipPath);
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
  });
});
