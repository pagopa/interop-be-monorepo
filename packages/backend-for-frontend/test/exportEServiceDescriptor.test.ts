import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import {
  DescriptorId,
  EServiceId,
  EServiceTemplateId,
  generateId,
  TenantId,
} from "pagopa-interop-models";
import {
  agreementApi,
  catalogApi,
  delegationApi,
} from "pagopa-interop-api-clients";
import { getMockAuthData, getMockContext } from "pagopa-interop-commons-test";
import { AuthData } from "pagopa-interop-commons";
import {
  AttributeProcessClient,
  DelegationProcessClient,
  EServiceTemplateProcessClient,
  InAppNotificationManagerClient,
  TenantProcessClient,
} from "../src/clients/clientsProvider.js";
import { catalogServiceBuilder } from "../src/services/catalogService.js";
import { config } from "../src/config/config.js";
import {
  delegatedEserviceNotExportable,
  invalidEServiceRequester,
  templateInstanceNotAllowed,
} from "../src/model/errors.js";
import * as delegationService from "../src/services/delegationService.js";
import { fileManager, getBffMockContext } from "./utils.js";

describe("exportEServiceDescriptor", () => {
  const tenantId: TenantId = generateId<TenantId>();
  const eServiceId: EServiceId = generateId<EServiceId>();
  const descriptorId: DescriptorId = generateId<DescriptorId>();
  const eServiceTemplateId: EServiceTemplateId =
    generateId<EServiceTemplateId>();
  const mockDate = "2023-01-01T12:00:00Z";

  const mockTenantProcessClient = {} as unknown as TenantProcessClient;
  const mockAgreementProcessClient =
    {} as unknown as agreementApi.AgreementProcessClient;
  const mockAttributeProcessClient = {} as unknown as AttributeProcessClient;
  const mockDelegationProcessClient = {} as unknown as DelegationProcessClient;
  const mockInAppNotificationManagerClient =
    {} as unknown as InAppNotificationManagerClient;
  const mockEServiceTemplateProcessClient =
    {} as unknown as EServiceTemplateProcessClient;

  const authData: AuthData = {
    ...getMockAuthData(),
    organizationId: tenantId,
  };
  const bffMockContext = getBffMockContext(getMockContext({ authData }));

  const baseEService: catalogApi.EService = {
    id: eServiceId,
    name: "mockEService",
    producerId: tenantId,
    description: "mockDescription",
    technology: "REST",
    descriptors: [
      {
        id: descriptorId,
        version: "1.0.0",
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
          uploadDate: new Date(mockDate).toISOString(),
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

  interface TestCatalogService {
    service: ReturnType<typeof catalogServiceBuilder>;
    catalogProcessClient: catalogApi.CatalogProcessClient;
  }

  const createTestCatalogService = (
    eService: catalogApi.EService,
    delegations: delegationApi.Delegation[] = []
  ): TestCatalogService => {
    const mockCatalogProcessClient = {
      getEServiceById: vi.fn().mockResolvedValue(eService),
    } as unknown as catalogApi.CatalogProcessClient;

    vi.spyOn(delegationService, "getAllDelegations").mockResolvedValue(
      delegations
    );

    return {
      service: catalogServiceBuilder(
        mockCatalogProcessClient,
        mockTenantProcessClient,
        mockAgreementProcessClient,
        mockAttributeProcessClient,
        mockDelegationProcessClient,
        mockEServiceTemplateProcessClient,
        mockInAppNotificationManagerClient,
        fileManager,
        config
      ),
      catalogProcessClient: mockCatalogProcessClient,
    };
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(mockDate));
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  describe("error cases", () => {
    it("should throw templateInstanceNotAllowed if eservice is instantiated from template", async () => {
      const templatedEService: catalogApi.EService = {
        ...baseEService,
        templateId: eServiceTemplateId,
      };

      const { service } = createTestCatalogService(templatedEService);

      await expect(
        service.exportEServiceDescriptor(
          eServiceId,
          descriptorId,
          bffMockContext
        )
      ).rejects.toThrowError(
        templateInstanceNotAllowed(eServiceId, eServiceTemplateId)
      );
    });

    it("should throw invalidEServiceRequester if requester is not the eservice producer", async () => {
      const differentProducerId = generateId<TenantId>();
      const differentProducerEService: catalogApi.EService = {
        ...baseEService,
        producerId: differentProducerId,
      };

      const { service } = createTestCatalogService(differentProducerEService);

      await expect(
        service.exportEServiceDescriptor(
          eServiceId,
          descriptorId,
          bffMockContext
        )
      ).rejects.toThrowError(
        invalidEServiceRequester(eServiceId, authData.organizationId)
      );
    });

    it("should throw delegatedEserviceNotExportable if eservice has delegates", async () => {
      const delegations: delegationApi.Delegation[] = [
        {
          id: "delegationId",
          delegatorId: "delegatorId",
          delegateId: "delegateId",
          eserviceId: eServiceId,
          createdAt: mockDate,
          state: "ACTIVE",
          kind: "DELEGATED_PRODUCER",
          stamps: {
            submission: {
              who: "who",
              when: mockDate,
            },
          },
        },
      ];

      const { service } = createTestCatalogService(baseEService, delegations);

      await expect(
        service.exportEServiceDescriptor(
          eServiceId,
          descriptorId,
          bffMockContext
        )
      ).rejects.toThrowError(
        delegatedEserviceNotExportable(authData.organizationId)
      );
    });
  });

  describe("success case", () => {
    it("should successfully export eservice descriptor", async () => {
      const zipFolderName = `${eServiceId}_${descriptorId}`;
      const zipFileName = `${zipFolderName}.zip`;
      const zipFilePath = `${config.exportEservicePath}/${authData.organizationId}`;
      const mockBuffer = Buffer.from("mock zip content");
      const mockPresignedUrl = "https://mockpresignedurl.com/file.zip";

      const { service, catalogProcessClient } = createTestCatalogService(
        baseEService,
        []
      );

      vi.spyOn(fileManager, "storeBytes").mockResolvedValue("mockResourceId");
      vi.spyOn(fileManager, "generateGetPresignedUrl").mockResolvedValue(
        mockPresignedUrl
      );
      vi.spyOn(fileManager, "get").mockResolvedValue(mockBuffer);

      const result = await service.exportEServiceDescriptor(
        eServiceId,
        descriptorId,
        bffMockContext
      );

      expect(catalogProcessClient.getEServiceById).toHaveBeenCalledWith({
        params: { eServiceId },
        headers: bffMockContext.headers,
      });

      expect(delegationService.getAllDelegations).toHaveBeenCalled();

      expect(fileManager.storeBytes).toHaveBeenCalledWith(
        expect.objectContaining({
          bucket: config.exportEserviceContainer,
          path: zipFilePath,
          name: zipFileName,
          content: expect.any(Buffer),
        }),
        bffMockContext.logger
      );

      expect(fileManager.generateGetPresignedUrl).toHaveBeenCalledWith(
        config.exportEserviceContainer,
        zipFilePath,
        zipFileName,
        config.presignedUrlGetDurationMinutes
      );

      expect(result).toEqual({
        filename: zipFileName,
        url: mockPresignedUrl,
      });
    });
  });
});
