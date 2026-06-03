import { genericLogger, WithLogger } from "pagopa-interop-commons";
import {
  getMockedApiAgreement,
  getMockedApiAttribute,
  getMockedApiTenant,
} from "pagopa-interop-commons-test";
import {
  agreementApi,
  attributeRegistryApi,
  catalogApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { AttributeId, generateId } from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { PagoPAInteropBeClients } from "../src/clients/clientsProvider.js";
import { enrichAgreement } from "../src/services/agreementService.js";
import { tenantAttributeKind } from "../src/api/tenantApiConverter.js";
import { BffAppContext } from "../src/utilities/context.js";
import {
  getMockCatalogApiEService,
  getMockCatalogApiEServiceDescriptor,
} from "./mockUtils.js";

describe("enrichAgreement", () => {
  it("should enrich agreement and merge tenant certified and certified discrete attributes", async () => {
    const agreementCertifiedDiscreteAttributeId = generateId<AttributeId>();
    const tenantCertifiedAttributeId = generateId<AttributeId>();
    const tenantCertifiedDiscreteAttributeId = generateId<AttributeId>();
    const eserviceId = generateId();
    const descriptorId = generateId();
    const producerId = generateId();
    const consumerId = generateId();

    const agreementCertifiedDiscreteRegistryAttribute = {
      ...getMockedApiAttribute({
        kind: attributeRegistryApi.AttributeKind.Values.CERTIFIED_DISCRETE,
        name: "agreement certified discrete",
        description: "agreement certified discrete description",
      }),
      id: agreementCertifiedDiscreteAttributeId,
    };
    const tenantCertifiedRegistryAttribute = {
      ...getMockedApiAttribute({
        kind: attributeRegistryApi.AttributeKind.Values.CERTIFIED,
        name: "tenant certified",
        description: "tenant certified description",
      }),
      id: tenantCertifiedAttributeId,
    };
    const tenantCertifiedDiscreteRegistryAttribute = {
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
    };
    const producer: tenantApi.Tenant = {
      ...getMockedApiTenant({ attributes: [] }),
      id: producerId,
      mails: [],
      features: [],
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
              : Promise.resolve(producer)
          ),
        },
      },
      catalogProcessClient: {
        getEServiceById: vi.fn().mockResolvedValue(eservice),
      },
      delegationProcessClient: {
        delegation: {
          getDelegations: vi.fn().mockResolvedValue({ results: [] }),
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
  });
});
