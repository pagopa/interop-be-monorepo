import { describe, expect, it, vi } from "vitest";
import {
  AttributeId,
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
import { AuthData } from "pagopa-interop-commons";
import { getMockAuthData, getMockContext } from "pagopa-interop-commons-test";
import type {
  DelegationProcessClient,
  TenantProcessClient,
} from "../src/clients/clientsProvider.js";
import { catalogServiceBuilder } from "../src/services/catalogService.js";
import { config } from "../src/config/config.js";
import { eserviceDescriptorNotFound } from "../src/model/errors.js";
import * as attributeService from "../src/services/attributeService.js";
import * as delegationService from "../src/services/delegationService.js";
import * as agreementService from "../src/services/agreementService.js";
import * as catalogApiConverter from "../src/api/catalogApiConverter.js";
import { fileManager, getBffMockContext } from "./utils.js";

describe("getCatalogEServiceDescriptor", () => {
  const eServiceId: EServiceId = generateId<EServiceId>();
  const mockDescriptorId: DescriptorId = generateId<DescriptorId>();
  const tenantId: TenantId = generateId<TenantId>();
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
            explicitAttributeVerification: false,
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
    agreements: [],
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
            id: certifiedAttributeId,
            name: certifiedAttributeName,
            explicitAttributeVerification: false,
          },
        ],
      ],
      declared: [
        [
          {
            description: attributeDescription,
            id: declaredAttributeId,
            name: declaredAttributeName,
            explicitAttributeVerification: false,
          },
        ],
      ],
      verified: [
        [
          {
            description: attributeDescription,
            id: verifiedAttributeId,
            name: verifiedAttributeName,
            explicitAttributeVerification: false,
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
  } as unknown as catalogApi.CatalogProcessClient;

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
  } as unknown as agreementApi.AgreementProcessClient;

  const mockAttributeProcessClient = {
    getBulkedAttributes: vi.fn().mockResolvedValue({
      results: [],
      totalCount: 0,
    }),
  } as unknown as attributeRegistryApi.AttributeProcessClient;

  const mockDelegationProcessClient = {
    producer: {},
    consumer: {},
    delegation: {
      getDelegations: vi.fn().mockResolvedValue([]),
    },
  } as unknown as DelegationProcessClient;

  const mockEServiceTemplateProcessClient =
    {} as unknown as eserviceTemplateApi.EServiceTemplateProcessClient;

  const mockInAppNotificationManagerClient =
    {} as unknown as inAppNotificationApi.InAppNotificationManagerClient;
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

  vi.spyOn(
    agreementService,
    "getLatestAgreementsOnDescriptor"
  ).mockResolvedValue([
    {
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
      stamps: {
        activation: {
          who: generateId(),
          when: "2023-02-02T00:00:00.000Z",
        },
      },
    },
  ]);

  vi.spyOn(
    catalogApiConverter,
    "toBffCatalogDescriptorEService"
  ).mockReturnValue(Promise.resolve(catalogDescriptorEService));

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
            id: generateId<DescriptorId>(),
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
});
