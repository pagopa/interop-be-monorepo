import { describe, expect, it, vi } from "vitest";
import {
  AttributeId,
  DescriptorId,
  EServiceId,
  generateId,
  TenantId,
} from "pagopa-interop-models";
import { bffApi, catalogApi } from "pagopa-interop-api-clients";
import { AuthData } from "pagopa-interop-commons";
import { getMockAuthData, getMockContext } from "pagopa-interop-commons-test";
import { catalogServiceBuilder } from "../src/services/catalogService.js";
import {
  AgreementProcessClient,
  AttributeProcessClient,
  CatalogProcessClient,
  DelegationProcessClient,
  EServiceTemplateProcessClient,
  TenantProcessClient,
} from "../src/clients/clientsProvider.js";
import { config } from "../src/config/config.js";
import {
  eserviceDescriptorNotFound,
  tenantNotFound,
} from "../src/model/errors.js";
import * as attributeService from "../src/services/attributeService.js";
import * as delegationService from "../src/services/delegationService.js";
import * as agreementService from "../src/services/agreementService.js";
import * as catalogApiConverter from "../src/api/catalogApiConverter.js";
import { fileManager, getBffMockContext } from "./utils.js";

describe("getCatalogEServiceDescriptor", () => {
  const eServiceId: EServiceId = generateId<EServiceId>();
  const mockDescriptorId: DescriptorId = generateId();
  const tenantId: TenantId = generateId();
  const tenantName = "mockTenant";

  const declaredAttributeId = generateId<AttributeId>();
  const certifiedAttributeId = generateId<AttributeId>();
  const verifiedAttributeId = generateId<AttributeId>();

  const declaredAttributeName = "mockDeclaredAttributeName";
  const certifiedAttributeName = "mockCertifiedAttributeName";
  const verifiedAttributeName = "mockVerifiedAttributeName";

  const attributeDescription = "mockDescription";

  const authData: AuthData = {
    ...getMockAuthData(),
    organizationId: tenantId,
  };
  const bffMockContext = getBffMockContext(getMockContext({ authData }));

  const eServiceDescriptor: catalogApi.EServiceDescriptor = {
    id: mockDescriptorId,
    state: "DRAFT",
    attributes: {
      declared: [
        [
          {
            id: declaredAttributeId,
            explicitAttributeVerification: false,
          },
        ],
      ],
      certified: [
        [
          {
            id: certifiedAttributeId,
            explicitAttributeVerification: false,
          },
        ],
      ],
      verified: [
        [
          {
            id: verifiedAttributeId,
            explicitAttributeVerification: true,
          },
        ],
      ],
    },
    version: "",
    serverUrls: [],
    audience: [],
    voucherLifespan: 0,
    dailyCallsPerConsumer: 0,
    dailyCallsTotal: 0,
    docs: [],
    agreementApprovalPolicy: "AUTOMATIC",
  };

  const eService: catalogApi.EService = {
    id: eServiceId,
    name: "mockEService",
    producerId: "mockProducerId",
    description: "mockDescription",
    technology: "REST",
    descriptors: [eServiceDescriptor],
    mode: "RECEIVE",
    riskAnalysis: [],
  };

  const catalogDescriptorEService: bffApi.CatalogDescriptorEService = {
    id: eService.id,
    name: eService.name,
    producer: {
      id: tenantId,
      name: tenantName,
      kind: undefined,
    },
    description: eService.description,
    technology: eService.technology,
    descriptors: [],
    agreement: undefined,
    isMine: false,
    hasCertifiedAttributes: false,
    isSubscribed: false,
    activeDescriptor: undefined,
    mail: undefined,
    mode: eService.mode,
    riskAnalysis: [],
    isSignalHubEnabled: eService.isSignalHubEnabled,
    isConsumerDelegable: eService.isConsumerDelegable,
    isClientAccessDelegable: eService.isClientAccessDelegable,
  };

  const expectedResult: bffApi.CatalogEServiceDescriptor = {
    id: eServiceDescriptor.id,
    version: eServiceDescriptor.version,
    description: eServiceDescriptor.description,
    state: eServiceDescriptor.state,
    audience: eServiceDescriptor.audience,
    voucherLifespan: eServiceDescriptor.voucherLifespan,
    dailyCallsPerConsumer: eServiceDescriptor.dailyCallsPerConsumer,
    dailyCallsTotal: eServiceDescriptor.dailyCallsPerConsumer,
    agreementApprovalPolicy: eServiceDescriptor.agreementApprovalPolicy,
    attributes: {
      certified: [
        [
          {
            description: attributeDescription,
            explicitAttributeVerification: false,
            id: certifiedAttributeId,
            name: certifiedAttributeName,
          },
        ],
      ],
      declared: [
        [
          {
            description: attributeDescription,
            explicitAttributeVerification: false,
            id: declaredAttributeId,
            name: declaredAttributeName,
          },
        ],
      ],
      verified: [
        [
          {
            description: attributeDescription,
            explicitAttributeVerification: true,
            id: verifiedAttributeId,
            name: verifiedAttributeName,
          },
        ],
      ],
    },
    publishedAt: eServiceDescriptor.publishedAt,
    suspendedAt: eServiceDescriptor.suspendedAt,
    deprecatedAt: eServiceDescriptor.deprecatedAt,
    archivedAt: eServiceDescriptor.archivedAt,
    interface: undefined,
    docs: [],
    eservice: catalogDescriptorEService,
  };

  const mockCatalogProcessClient = {
    getEServiceById: vi.fn().mockResolvedValue(eService),
  } as unknown as CatalogProcessClient;

  const mockTenantProcessClient = {
    tenant: {
      getTenant: vi.fn().mockResolvedValue({
        id: tenantId,
        name: tenantName,
        attributes: [],
      }),
    },
  } as unknown as TenantProcessClient;

  const mockAgreementProcessClient = {
    getAgreement: vi.fn(),
    getAgreements: vi.fn(),
  } as unknown as AgreementProcessClient;

  const mockAttributeProcessClient = {
    getBulkedAttributes: vi.fn().mockResolvedValue({
      results: [],
      totalCount: 0,
    }),
  } as unknown as AttributeProcessClient;

  const mockDelegationProcessClient = {
    delegation: {
      getDelegations: vi.fn().mockResolvedValue([]),
    },
  } as unknown as DelegationProcessClient;

  const mockEServiceTemplateProcessClient =
    {} as unknown as EServiceTemplateProcessClient;

  vi.spyOn(attributeService, "getAllBulkAttributes").mockResolvedValue([
    {
      id: certifiedAttributeId,
      name: certifiedAttributeName,
      description: "mockDescription",
      kind: "VERIFIED",
      creationTime: new Date().toTimeString(),
    },
    {
      id: declaredAttributeId,
      name: declaredAttributeName,
      description: attributeDescription,
      kind: "VERIFIED",
      creationTime: new Date().toTimeString(),
    },
    {
      id: verifiedAttributeId,
      name: verifiedAttributeName,
      description: attributeDescription,
      kind: "VERIFIED",
      creationTime: new Date().toTimeString(),
    },
  ]);

  vi.spyOn(delegationService, "getAllDelegations").mockResolvedValue([]);

  vi.spyOn(agreementService, "getLatestAgreement").mockResolvedValue({
    id: generateId(),
    eserviceId: eServiceId,
    descriptorId: mockDescriptorId,
    producerId: generateId(),
    consumerId: authData.organizationId,
    state: "ACTIVE",
    verifiedAttributes: [],
    certifiedAttributes: [],
    declaredAttributes: [],
    consumerDocuments: [],
    createdAt: "2023-01-01T00:00:00.000Z",
  });

  vi.spyOn(
    catalogApiConverter,
    "toBffCatalogDescriptorEService"
  ).mockReturnValue(catalogDescriptorEService);

  const catalogService = catalogServiceBuilder(
    mockCatalogProcessClient,
    mockTenantProcessClient,
    mockAgreementProcessClient,
    mockAttributeProcessClient,
    mockDelegationProcessClient,
    mockEServiceTemplateProcessClient,
    fileManager,
    config
  );

  it("should retrieve the descriptor successfully", async () => {
    expect(
      await catalogService.getCatalogEServiceDescriptor(
        eServiceId,
        mockDescriptorId,
        bffMockContext
      )
    ).toEqual(expectedResult);

    expect(attributeService.getAllBulkAttributes).toHaveBeenCalledWith(
      mockAttributeProcessClient,
      bffMockContext.headers,
      [certifiedAttributeId, declaredAttributeId, verifiedAttributeId]
    );
  });

  it("should throw eserviceDescriptorNotFound if descriptorId cannot be found in eservice's descriptors", async () => {
    vi.spyOn(mockCatalogProcessClient, "getEServiceById").mockResolvedValueOnce(
      {
        ...eService,
        descriptors: [
          {
            ...eServiceDescriptor,
            id: "invalid-descriptorId",
          },
        ],
      }
    );

    await expect(
      catalogService.getCatalogEServiceDescriptor(
        eServiceId,
        mockDescriptorId,
        bffMockContext
      )
    ).rejects.toThrowError(
      eserviceDescriptorNotFound(eServiceId, mockDescriptorId)
    );
  });

  it("should throw tenant not found", async () => {
    vi.spyOn(mockTenantProcessClient.tenant, "getTenant").mockRejectedValueOnce(
      new tenantNotFound(authData.organizationId)
    );

    await expect(
      catalogService.getCatalogEServiceDescriptor(
        eServiceId,
        mockDescriptorId,
        bffMockContext
      )
    ).rejects.toThrowError(tenantNotFound(authData.organizationId));
  });
});
