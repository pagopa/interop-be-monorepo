import {
  agreementApi,
  attributeRegistryApi,
  catalogApi,
  eserviceTemplateApi,
  inAppNotificationApi,
} from "pagopa-interop-api-clients";
import { AuthData } from "pagopa-interop-commons";
import { getMockAuthData, getMockContext } from "pagopa-interop-commons-test";
import {
  DescriptorId,
  EServiceDocumentId,
  EServiceId,
  generateId,
  TenantId,
} from "pagopa-interop-models";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AuthorizationProcessClient,
  DelegationProcessClient,
  TenantProcessClient,
} from "../src/clients/clientsProvider.js";

import { config } from "../src/config/config.js";
import { catalogServiceBuilder } from "../src/services/catalogService.js";
import { getMockCatalogApiEServiceDoc } from "./mockUtils.js";
import { fileManager, getBffMockContext } from "./utils.js";

describe("getEServiceDocumentById", () => {
  const tenantId: TenantId = generateId<TenantId>();
  const eServiceId: EServiceId = generateId<EServiceId>();
  const descriptorId: DescriptorId = generateId<DescriptorId>();
  const documentId: EServiceDocumentId = generateId<EServiceDocumentId>();

  const descriptor: catalogApi.EServiceDescriptor = {
    id: descriptorId,
    state: "PUBLISHED",
    attributes: {
      declared: [],
      certified: [],
      verified: [],
    },
    version: "3",
    serverUrls: [],
    audience: [],
    voucherLifespan: 60,
    dailyCallsPerConsumer: 1,
    dailyCallsTotal: 1,
    docs: [],
    agreementApprovalPolicy: "AUTOMATIC",
  };

  const eService: catalogApi.EService = {
    id: eServiceId,
    name: "Servizio Anagrafe",
    producerId: tenantId,
    description: "mockDescription",
    technology: "REST",
    descriptors: [descriptor],
    mode: "RECEIVE",
    riskAnalysis: [],
  };

  const document = {
    ...getMockCatalogApiEServiceDoc(),
    id: documentId,
    name: "openapi.yaml",
    contentType: "application/octet-stream",
    path: "path/to/openapi.yaml",
  };

  const mockCatalogProcessClient = {
    getEServiceById: vi.fn().mockResolvedValue(eService),
    getEServiceDocumentById: vi.fn().mockResolvedValue(document),
  } as unknown as catalogApi.CatalogProcessClient;

  const mockTenantProcessClient = {
    tenant: {
      getTenant: vi.fn().mockResolvedValue({
        id: tenantId,
        name: "Comune di Forlì",
        attributes: [],
        mails: [],
      }),
    },
  } as unknown as TenantProcessClient;

  const mockAgreementProcessClient =
    {} as unknown as agreementApi.AgreementProcessClient;
  const mockAttributeProcessClient =
    {} as unknown as attributeRegistryApi.AttributeProcessClient;
  const mockAuthorizationClient = {} as unknown as AuthorizationProcessClient;
  const mockDelegationProcessClient = {} as unknown as DelegationProcessClient;
  const mockEServiceTemplateProcessClient =
    {} as unknown as eserviceTemplateApi.EServiceTemplateProcessClient;
  const mockInAppNotificationManagerClient =
    {} as unknown as inAppNotificationApi.InAppNotificationManagerClient;

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

  const authData: AuthData = {
    ...getMockAuthData(),
    organizationId: tenantId,
  };

  const bffMockContext = getBffMockContext(getMockContext({ authData }));

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return the document content along with the standardized filename", async () => {
    const mockBuffer = Buffer.from("openapi content");
    vi.spyOn(fileManager, "get").mockResolvedValue(mockBuffer);

    const result = await catalogService.getEServiceDocumentById(
      eServiceId,
      descriptorId,
      documentId,
      bffMockContext
    );

    expect(
      mockCatalogProcessClient.getEServiceDocumentById
    ).toHaveBeenCalledWith({
      params: { eServiceId, descriptorId, documentId },
      headers: bffMockContext.headers,
    });
    expect(fileManager.get).toHaveBeenCalledWith(
      config.eserviceDocumentsContainer,
      document.path,
      bffMockContext.logger
    );

    expect(result).toEqual({
      contentType: document.contentType,
      document: mockBuffer,
      filename: "Specifica API_Servizio Anagrafe_Comune di Forlì_v3.yaml",
    });
  });

  it("should preserve the original document extension", async () => {
    vi.spyOn(fileManager, "get").mockResolvedValue(Buffer.from("content"));
    vi.spyOn(
      mockCatalogProcessClient,
      "getEServiceDocumentById"
    ).mockResolvedValueOnce({
      ...document,
      name: "manuale.pdf",
    });

    const result = await catalogService.getEServiceDocumentById(
      eServiceId,
      descriptorId,
      documentId,
      bffMockContext
    );

    expect(result.filename).toBe(
      "Specifica API_Servizio Anagrafe_Comune di Forlì_v3.pdf"
    );
  });
});
