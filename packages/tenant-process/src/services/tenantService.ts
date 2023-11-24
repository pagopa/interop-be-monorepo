import {
  AuthData,
  CreateEvent,
  eventRepository,
  initDB,
} from "pagopa-interop-commons";
import {
  ExternalId,
  Tenant,
  TenantAttribute,
  TenantEvent,
  TenantFeature,
  TenantKind,
  TenantMail,
  WithMetadata,
  tenantAttributeType,
  tenantEventToBinaryData,
  tenantMailKind,
} from "pagopa-interop-models";
import { v4 as uuidv4 } from "uuid";
import { config } from "../utilities/config.js";
import {
  toCreateEventTenantAdded,
  toCreateEventTenantUpdated,
} from "../model/domain/toEvent.js";
import {
  ApiInternalTenantSeed,
  ApiM2MTenantSeed,
  ApiSelfcareTenantSeed,
  ApiTenantMailsSeed,
} from "../model/types.js";
import {
  invalidAttributeStructure,
  attributeNotFound,
  tenantDuplicate,
} from "../model/domain/errors.js";
import {
  assertAttributeExists,
  assertResourceAllowed,
  assertTenantExists,
  getTenantKindLoadingCertifiedAttributes,
} from "./validators.js";
import { readModelService } from "./readModelService.js";

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

export const tenantService = {
  async createTenant(
    apiTenantSeed:
      | ApiSelfcareTenantSeed
      | ApiM2MTenantSeed
      | ApiInternalTenantSeed,
    attributesExternalIds: ExternalId[],
    kind: TenantKind
  ): Promise<string> {
    const attributes = await readModelService.getAttributesByExternalIds(
      attributesExternalIds
    );
    const tenantAttributes: TenantAttribute[] = attributes.map((attribute) => ({
      type: tenantAttributeType.CERTIFIED, // All attributes here are certified
      id: attribute.data.id,
      assignmentTimestamp: new Date(),
    }));

    return repository.createEvent(
      createTenantLogic({
        tenant: await readModelService.getTenantByName(apiTenantSeed.name),
        apiTenantSeed,
        kind,
        tenantAttributes,
      })
    );
  },

  async updateTenantAttribute(
    tenantId: string,
    attributeId: string,
    newAttribute: TenantAttribute
  ): Promise<string> {
    const tenant = await readModelService.getTenantById(tenantId);
    assertTenantExists(tenantId, tenant);

    if (!newAttribute || newAttribute.id !== attributeId) {
      throw invalidAttributeStructure;
    }

    return await repository.createEvent(
      await updateTenantAttributeLogic({
        tenant,
        attributeId,
        newAttribute,
      })
    );
  },

  async updateTenant({
    tenantId,
    selfcareId,
    features,
    mails,
    kind,
  }: {
    tenantId: string;
    selfcareId: string | undefined;
    features: TenantFeature[];
    mails: TenantMail[];
    kind: TenantKind;
  }): Promise<string> {
    const tenant = await readModelService.getTenantById(tenantId);
    assertTenantExists(tenantId, tenant);

    return await repository.createEvent(
      await updateTenantLogic({
        tenant,
        selfcareId,
        features,
        mails,
        kind,
      })
    );
  },

  async updateTenantMails({
    tenantId,
    mailsSeed,
    authData,
  }: {
    tenantId: string;
    mailsSeed: ApiTenantMailsSeed;
    authData: AuthData;
  }) {
    assertResourceAllowed(tenantId, authData);
    const tenant = await readModelService.getTenantById(tenantId);
    assertTenantExists(tenantId, tenant);
    const tenantKind =
      tenant.data.kind ||
      (await getTenantKindLoadingCertifiedAttributes(
        tenant.data.attributes,
        tenant.data.externalId
      ));
    const tenantMails: TenantMail[] = mailsSeed.mails.map((mail) => ({
      ...mail,
      kind: tenantMailKind.ContactEmail,
      createdAt: new Date(),
    }));

    return this.updateTenant({
      tenantId: tenantId,
      selfcareId: tenant.data.selfcareId,
      features: tenant.data.features,
      kind: tenantKind,
      mails: tenantMails,
    });
  },
};

export async function updateTenantAttributeLogic({
  tenant,
  attributeId,
  newAttribute,
}: {
  tenant: WithMetadata<Tenant>;
  attributeId: string;
  newAttribute: TenantAttribute;
}): Promise<CreateEvent<TenantEvent>> {
  assertAttributeExists(attributeId, tenant.data.attributes);
  const attributeExists = tenant.data.attributes.some(
    (attribute) => attribute.id === attributeId
  );
  if (!attributeExists) {
    throw attributeNotFound(attributeId);
  }

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
  tenantAttributes,
}: {
  tenant: WithMetadata<Tenant> | undefined;
  apiTenantSeed:
    | ApiSelfcareTenantSeed
    | ApiM2MTenantSeed
    | ApiInternalTenantSeed;
  kind: TenantKind;
  tenantAttributes: TenantAttribute[];
}): CreateEvent<TenantEvent> {
  if (tenant) {
    throw tenantDuplicate(apiTenantSeed.name);
  }

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
