import {
  agreementApi,
  attributeRegistryApi,
  catalogApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { genericLogger, WithLogger } from "pagopa-interop-commons";
import {
  getMockedApiAgreement,
  getMockedApiAttribute,
  getMockedApiTenant,
} from "pagopa-interop-commons-test";
import { AttributeId, generateId } from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";

import { toBffCompactOrganization } from "../src/api/agreementApiConverter.js";
import { tenantAttributeKind } from "../src/api/tenantApiConverter.js";
import { PagoPAInteropBeClients } from "../src/clients/clientsProvider.js";
import {
  agreementServiceBuilder,
  enrichAgreement,
} from "../src/services/agreementService.js";
import { BffAppContext } from "../src/utilities/context.js";
import {
  getMockCatalogApiEService,
  getMockCatalogApiEServiceDescriptor,
  getMockDelegationApiDelegation,
} from "./mockUtils.js";
import { fileManager } from "./utils.js";

describe("enrichAgreement", () => {
  it("should enrich agreement and merge tenant certified and certified discrete attributes", async () => {
    const agreementCertifiedDiscreteAttributeId = generateId<AttributeId>();
    const tenantCertifiedAttributeId = generateId<AttributeId>();
    const tenantCertifiedDiscreteAttributeId = generateId<AttributeId>();
    const eserviceId = generateId();
    const descriptorId = generateId();
    const producerId = generateId();
    const consumerId = generateId();
    const parentTenants: tenantApi.ParentTenant[] = [
      { id: generateId(), name: "Tenant AOO", subUnitType: "AOO" },
      { id: generateId(), name: "Tenant root" },
    ];

    const agreementCertifiedDiscreteRegistryAttribute: attributeRegistryApi.Attribute =
      {
        ...getMockedApiAttribute({
          kind: attributeRegistryApi.AttributeKind.Values.CERTIFIED_DISCRETE,
          name: "agreement certified discrete",
          description: "agreement certified discrete description",
        }),
        id: agreementCertifiedDiscreteAttributeId,
      };
    const tenantCertifiedRegistryAttribute: attributeRegistryApi.Attribute = {
      ...getMockedApiAttribute({
        kind: attributeRegistryApi.AttributeKind.Values.CERTIFIED,
        name: "tenant certified",
        description: "tenant certified description",
      }),
      id: tenantCertifiedAttributeId,
    };
    const tenantCertifiedDiscreteRegistryAttribute: attributeRegistryApi.Attribute =
      {
        ...getMockedApiAttribute({
          kind: attributeRegistryApi.AttributeKind.Values.CERTIFIED_DISCRETE,
          name: "tenant certified discrete",
          description: "tenant certified discrete description",
        }),
        id: tenantCertifiedDiscreteAttributeId,
      };
    const registryAttributes = [
      agreementCertifiedDiscreteRegistryAttribute,
      tenantCertifiedRegistryAttribute,
      tenantCertifiedDiscreteRegistryAttribute,
    ];

    const agreement: agreementApi.Agreement = {
      ...getMockedApiAgreement({
        eserviceId,
        descriptorId,
        consumerId,
        consumerDocuments: [],
        stamps: {},
      }),
      producerId,
      verifiedAttributes: [],
      certifiedAttributes: [],
      certifiedDiscreteAttributes: [
        { id: agreementCertifiedDiscreteAttributeId },
      ],
      declaredAttributes: [],
    };

    const certifiedAssignmentTimestamp = new Date().toISOString();
    const certifiedDiscreteAssignmentTimestamp = new Date().toISOString();
    const consumer: tenantApi.Tenant = {
      ...getMockedApiTenant({
        attributes: [
          {
            certified: {
              id: tenantCertifiedAttributeId,
              assignmentTimestamp: certifiedAssignmentTimestamp,
            },
          },
          {
            certifiedDiscrete: {
              id: tenantCertifiedDiscreteAttributeId,
              assignmentTimestamp: certifiedDiscreteAssignmentTimestamp,
              discreteValue: 42,
            },
          },
        ],
      }),
      id: consumerId,
      mails: [],
      features: [],
      subUnitType: "UO",
      parentTenants,
    };
    const producer: tenantApi.Tenant = {
      ...getMockedApiTenant({ attributes: [] }),
      id: producerId,
      mails: [],
      features: [],
      subUnitType: "UO",
      parentTenants,
    };
    const delegate: tenantApi.Tenant = {
      ...getMockedApiTenant({ attributes: [] }),
      subUnitType: "UO",
      parentTenants,
    };
    const delegation = {
      ...getMockDelegationApiDelegation(),
      delegateId: delegate.id,
      delegatorId: consumerId,
      eserviceId,
      state: "ACTIVE" as const,
      kind: "DELEGATED_CONSUMER" as const,
    };
    const descriptor: catalogApi.EServiceDescriptor = {
      ...getMockCatalogApiEServiceDescriptor(),
      id: descriptorId,
      state: catalogApi.EServiceDescriptorState.Values.PUBLISHED,
      attributes: {
        certified: [
          [
            {
              id: agreementCertifiedDiscreteAttributeId,
              explicitAttributeVerification: false,
              discreteConfig: {
                threshold: 1,
                comparator: "GTE",
              },
            },
          ],
        ],
        declared: [],
        verified: [],
      },
    };
    const eservice: catalogApi.EService = {
      ...getMockCatalogApiEService(),
      id: eserviceId,
      producerId,
      descriptors: [descriptor],
    };

    const clients = {
      tenantProcessClient: {
        tenant: {
          getTenant: vi.fn(({ params }: { params: { id: string } }) =>
            params.id === consumerId
              ? Promise.resolve(consumer)
              : Promise.resolve(params.id === delegate.id ? delegate : producer)
          ),
        },
      },
      catalogProcessClient: {
        getEServiceById: vi.fn().mockResolvedValue(eservice),
      },
      delegationProcessClient: {
        delegation: {
          getDelegations: vi
            .fn()
            .mockResolvedValue({ results: [delegation], totalCount: 1 }),
        },
      },
      attributeProcessClient: {
        getBulkedAttributes: vi.fn((attributeIds: string[]) =>
          Promise.resolve({
            results: registryAttributes.filter((attribute) =>
              attributeIds.includes(attribute.id)
            ),
          })
        ),
      },
    } as unknown as PagoPAInteropBeClients;

    const ctx: WithLogger<BffAppContext> = {
      authData: { organizationId: consumerId },
      headers: {
        "X-Correlation-Id": generateId(),
        Authorization: "authorization",
        "X-Forwarded-For": "x-forwarded-for",
      },
      logger: genericLogger,
    } as WithLogger<BffAppContext>;

    const actualAgreement = await enrichAgreement(agreement, clients, ctx);

    expect(actualAgreement.certifiedDiscreteAttributes).toStrictEqual([
      {
        id: agreementCertifiedDiscreteAttributeId,
        name: agreementCertifiedDiscreteRegistryAttribute.name,
        description: agreementCertifiedDiscreteRegistryAttribute.description,
        creationTime: agreementCertifiedDiscreteRegistryAttribute.creationTime,
      },
    ]);
    expect(actualAgreement.consumer.attributes.certified).toStrictEqual([
      {
        kind: tenantAttributeKind.certified,
        id: tenantCertifiedAttributeId,
        name: tenantCertifiedRegistryAttribute.name,
        description: tenantCertifiedRegistryAttribute.description,
        assignmentTimestamp: certifiedAssignmentTimestamp,
        revocationTimestamp: undefined,
      },
      {
        kind: tenantAttributeKind.certifiedDiscrete,
        id: tenantCertifiedDiscreteAttributeId,
        name: tenantCertifiedDiscreteRegistryAttribute.name,
        description: tenantCertifiedDiscreteRegistryAttribute.description,
        assignmentTimestamp: certifiedDiscreteAssignmentTimestamp,
        revocationTimestamp: undefined,
        discreteValue: 42,
      },
    ]);
    expect(actualAgreement.consumer.attributes).not.toHaveProperty(
      "certifiedDiscrete"
    );
    expect(
      clients.attributeProcessClient.getBulkedAttributes
    ).toHaveBeenCalledWith(
      expect.arrayContaining([
        agreementCertifiedDiscreteAttributeId,
        tenantCertifiedAttributeId,
        tenantCertifiedDiscreteAttributeId,
      ]),
      expect.any(Object)
    );
    expect(actualAgreement.producer).toMatchObject({
      id: producerId,
      subUnitType: "UO",
      parentTenants,
    });
    expect(actualAgreement.consumer).toMatchObject({
      id: consumerId,
      subUnitType: "UO",
      parentTenants,
    });
    expect(actualAgreement.delegation?.delegate).toMatchObject({
      id: delegate.id,
      subUnitType: "UO",
      parentTenants,
    });
  });

  describe("toBffCompactOrganization", () => {
    it("should preserve organization information without hierarchy", () => {
      const organization = { id: generateId(), name: "Tenant root" };

      expect(toBffCompactOrganization(organization, true)).toEqual({
        ...organization,
        hasUnreadNotifications: true,
        subUnitType: undefined,
        parentTenants: undefined,
      });
    });

    it("should return the parent and root tenants when available", () => {
      const organization: agreementApi.CompactOrganization = {
        id: generateId(),
        name: "Tenant UO",
        subUnitType: "UO",
        parentTenants: [
          { id: generateId(), name: "Tenant AOO", subUnitType: "AOO" },
          { id: generateId(), name: "Tenant root" },
        ],
      };

      expect(toBffCompactOrganization(organization)).toEqual({
        ...organization,
        hasUnreadNotifications: false,
      });
    });
  });

  describe("agreement tenant hierarchy", () => {
    const parentTenants: tenantApi.ParentTenant[] = [
      { id: generateId(), name: "Tenant AOO", subUnitType: "AOO" },
      { id: generateId(), name: "Tenant root" },
    ];
    const consumer: tenantApi.Tenant = {
      ...getMockedApiTenant({ attributes: [] }),
      subUnitType: "UO",
      parentTenants,
    };
    const producer: tenantApi.Tenant = {
      ...getMockedApiTenant({ attributes: [] }),
      subUnitType: "UO",
      parentTenants,
    };
    const delegate: tenantApi.Tenant = {
      ...getMockedApiTenant({ attributes: [] }),
      subUnitType: "UO",
      parentTenants,
    };
    const descriptor = {
      ...getMockCatalogApiEServiceDescriptor(),
      attributes: { certified: [], declared: [], verified: [] },
    };
    const eservice = {
      ...getMockCatalogApiEService(),
      producerId: producer.id,
      descriptors: [descriptor],
    };
    const agreement = {
      ...getMockedApiAgreement({
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
        consumerId: consumer.id,
        consumerDocuments: [],
        stamps: {},
      }),
      producerId: producer.id,
      certifiedAttributes: [],
      certifiedDiscreteAttributes: [],
      verifiedAttributes: [],
      declaredAttributes: [],
    };
    const delegation = {
      ...getMockDelegationApiDelegation(),
      delegateId: delegate.id,
      delegatorId: consumer.id,
      eserviceId: eservice.id,
      state: "ACTIVE" as const,
      kind: "DELEGATED_CONSUMER" as const,
    };
    const clients = {
      agreementProcessClient: {
        getAgreements: vi
          .fn()
          .mockResolvedValue({ results: [agreement], totalCount: 1 }),
      },
      inAppNotificationManagerClient: {
        filterUnreadNotifications: vi.fn().mockResolvedValue([]),
      },
      tenantProcessClient: {
        tenant: {
          getTenant: vi.fn(({ params }: { params: { id: string } }) =>
            Promise.resolve(
              params.id === consumer.id
                ? consumer
                : params.id === delegate.id
                  ? delegate
                  : producer
            )
          ),
        },
      },
      catalogProcessClient: {
        getEServiceById: vi.fn().mockResolvedValue(eservice),
      },
      delegationProcessClient: {
        delegation: {
          getDelegations: vi
            .fn()
            .mockResolvedValue({ results: [delegation], totalCount: 1 }),
          getDelegation: vi.fn().mockResolvedValue(delegation),
        },
      },
      attributeProcessClient: {
        getBulkedAttributes: vi.fn().mockResolvedValue({ results: [] }),
      },
    } as unknown as PagoPAInteropBeClients;
    const ctx = {
      authData: { organizationId: consumer.id },
      headers: {
        "X-Correlation-Id": generateId(),
        Authorization: "authorization",
        "X-Forwarded-For": "x-forwarded-for",
      },
      logger: genericLogger,
    } as WithLogger<BffAppContext>;

    const service = agreementServiceBuilder(clients, fileManager);
    const filters = {
      offset: 0,
      limit: 10,
      eservicesIds: [],
      consumersIds: [],
      producersIds: [],
      states: [],
    };

    it("should return producer, consumer and delegate hierarchy in consumer agreements", async () => {
      const result = await service.getConsumerAgreements(filters, ctx);
      expect(result.results[0].eservice.producer).toMatchObject({
        id: producer.id,
        subUnitType: "UO",
        parentTenants,
      });
      expect(result.results[0].consumer).toMatchObject({
        id: consumer.id,
        subUnitType: "UO",
        parentTenants,
      });
      expect(result.results[0].delegation?.delegate).toMatchObject({
        id: delegate.id,
        subUnitType: "UO",
        parentTenants,
      });
    });

  });
});
