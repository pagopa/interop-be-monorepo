/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { CreateEvent, eventRepository, initDB } from "pagopa-interop-commons";
import {
  Attribute,
  ExternalId,
  Tenant,
  TenantAttribute,
  TenantEvent,
  TenantFeature,
  TenantKind,
  TenantMail,
  TenantVerifier,
  VerifiedTenantAttribute,
  WithMetadata,
  tenantAttributeType,
  tenantEventToBinaryData,
} from "pagopa-interop-models";
import { v4 as uuidv4 } from "uuid";
import { TenantProcessConfig } from "../utilities/config.js";
import {
  toCreateEventTenantAdded,
  toCreateEventTenantUpdated,
} from "../model/domain/toEvent.js";
import {
  ApiInternalTenantSeed,
  ApiM2MTenantSeed,
  ApiSelfcareTenantSeed,
} from "../model/types.js";
import {
  ExpirationDateNotFoundInVerifier,
  OrganizationNotFoundInVerifiers,
  VerifiedAttributeNotFoundInTenant,
  invalidAttributeStructure,
  tenantDuplicate,
} from "../model/domain/errors.js";
import { assertAttributeExists, assertTenantExists } from "./validators.js";
import { ReadModelService } from "./readModelService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantServiceBuilder(
  config: TenantProcessConfig,
  readModelService: ReadModelService
) {
  const repository = eventRepository(
    initDB({
      username: config.eventStoreDbUsername,
      password: config.eventStoreDbPassword,
      host: config.eventStoreDbHost,
      port: config.eventStoreDbPort,
      database: config.eventStoreDbName,
      schema: config.eventStoreDbSchema,
      useSSL: config.eventStoreDbUseSSL,
    }),
    tenantEventToBinaryData
  );
  return {
    async createTenant(
      apiTenantSeed:
        | ApiSelfcareTenantSeed
        | ApiM2MTenantSeed
        | ApiInternalTenantSeed,
      attributesExternalIds: ExternalId[],
      kind: TenantKind
    ): Promise<string> {
      const [attributes, tenant] = await Promise.all([
        readModelService.getAttributesByExternalIds(attributesExternalIds),
        readModelService.getTenantByName(apiTenantSeed.name),
      ]);

      return repository.createEvent(
        createTenantLogic({
          tenant,
          apiTenantSeed,
          kind,
          attributes,
        })
      );
    },

    async updateTenantAttribute(
      tenantId: string,
      attributeId: string,
      newAttribute: TenantAttribute
    ): Promise<string> {
      const tenant = await readModelService.getTenantById(tenantId);

      return await repository.createEvent(
        await updateTenantAttributeLogic({
          tenant,
          tenantId,
          attributeId,
          newAttribute,
        })
      );
    },
    async updateVerifiedAttributeExtensionDate(
      tenantId: string,
      attributeId: string,
      verifierId: string
    ): Promise<string> {
      const tenant = await readModelService.getTenantById(tenantId);

      return await repository.createEvent(
        await updateVerifiedAttributeExtensionDateLogic({
          tenantId,
          attributeId,
          verifierId,
          tenant,
        })
      );
    },
  };
}
export async function updateTenantAttributeLogic({
  tenant,
  tenantId,
  attributeId,
  newAttribute,
}: {
  tenant: WithMetadata<Tenant> | undefined;
  tenantId: string;
  attributeId: string;
  newAttribute: TenantAttribute;
}): Promise<CreateEvent<TenantEvent>> {
  assertTenantExists(tenantId, tenant);
  if (!newAttribute || newAttribute.id !== attributeId) {
    throw invalidAttributeStructure;
  }
  assertAttributeExists(attributeId, tenant.data.attributes);

  const updatedAttributes = [
    newAttribute,
    ...tenant.data.attributes.filter((a) => a.id !== newAttribute.id),
  ];

  const newTenant: Tenant = {
    ...tenant.data,
    attributes: updatedAttributes,
    updatedAt: new Date(),
  };

  return toCreateEventTenantUpdated(
    tenant.data.id,
    tenant.metadata.version,
    newTenant
  );
}

export async function updateTenantLogic({
  tenant,
  selfcareId,
  features,
  mails,
  kind,
}: {
  tenant: WithMetadata<Tenant>;
  selfcareId: string | undefined;
  features: TenantFeature[];
  mails: TenantMail[];
  kind: TenantKind;
}): Promise<CreateEvent<TenantEvent>> {
  const newTenant: Tenant = {
    ...tenant.data,
    selfcareId,
    features,
    mails,
    kind,
    updatedAt: new Date(),
  };

  return toCreateEventTenantUpdated(
    tenant.data.id,
    tenant.metadata.version,
    newTenant
  );
}

export function createTenantLogic({
  tenant,
  apiTenantSeed,
  kind,
  attributes,
}: {
  tenant: WithMetadata<Tenant> | undefined;
  apiTenantSeed:
    | ApiSelfcareTenantSeed
    | ApiM2MTenantSeed
    | ApiInternalTenantSeed;
  kind: TenantKind;
  attributes: Array<WithMetadata<Attribute>>;
}): CreateEvent<TenantEvent> {
  if (tenant) {
    throw tenantDuplicate(apiTenantSeed.name);
  }

  const tenantAttributes: TenantAttribute[] = attributes.map((attribute) => ({
    type: tenantAttributeType.CERTIFIED, // All attributes here are certified
    id: attribute.data.id,
    assignmentTimestamp: new Date(),
  }));

  const newTenant: Tenant = {
    id: uuidv4(),
    name: apiTenantSeed.name,
    attributes: tenantAttributes,
    externalId: apiTenantSeed.externalId,
    features: [],
    mails: [],
    createdAt: new Date(),
    kind,
  };

  return toCreateEventTenantAdded(newTenant);
}

export async function updateVerifiedAttributeExtensionDateLogic({
  tenantId,
  attributeId,
  verifierId,
  tenant,
}: {
  tenantId: string;
  attributeId: string;
  verifierId: string;
  tenant: WithMetadata<Tenant> | undefined;
}): Promise<CreateEvent<TenantEvent>> {
  assertTenantExists(tenantId, tenant);

  const verifiedTenantAttribute = tenant.data.attributes.find(
    (attr) => attr.id === attributeId && attr.type === "verified"
  ) as VerifiedTenantAttribute;

  if (!verifiedTenantAttribute) {
    VerifiedAttributeNotFoundInTenant(tenantId, attributeId);
  }

  const tenantVerifier = verifiedTenantAttribute.verifiedBy.find(
    (verifier) => verifier.id === verifierId
  );

  if (!tenantVerifier) {
    OrganizationNotFoundInVerifiers(verifierId, tenantId, attributeId);
  }

  if (!tenantVerifier?.expirationDate) {
    ExpirationDateNotFoundInVerifier(tenantId, attributeId, verifierId);
  }

  const extensionDate =
    tenantVerifier?.extensionDate ?? tenantVerifier?.expirationDate;

  const updatedVerifiedBy: TenantVerifier[] =
    verifiedTenantAttribute.verifiedBy.map((verifier) => {
      if (verifier.id === tenantVerifier?.id) {
        return {
          ...tenantVerifier,
          extensionDate,
        };
      }
      return verifier;
    });

  const updatedVerifiedAttribute: VerifiedTenantAttribute = {
    ...verifiedTenantAttribute,
    verifiedBy: updatedVerifiedBy,
  };

  const updatedAttributes: TenantAttribute[] = tenant.data.attributes.map(
    (attr) => {
      if (attr.id === updatedVerifiedAttribute.id) {
        return updatedVerifiedAttribute;
      }
      return attr;
    }
  );
  const newTenant: Tenant = {
    ...tenant.data,
    attributes: updatedAttributes,
  };

  return toCreateEventTenantUpdated(
    tenant.data.id,
    tenant.metadata.version,
    newTenant
  );
}
