import {
  AuthData,
  CreateEvent,
  eventRepository,
  initDB,
} from "pagopa-interop-commons";
import {
  Attribute,
  ExternalId,
  Tenant,
  TenantAttribute,
  TenantEvent,
  TenantKind,
  WithMetadata,
  tenantAttributeType,
  tenantEventToBinaryData,
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
  tenantDuplicate,
  selfcareIdConflict,
} from "../model/domain/errors.js";
import { toTenantMails } from "../model/domain/apiConverter.js";
import {
  assertAttributeExists,
  assertResourceAllowed,
  assertTenantExists,
  getTenantKind,
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

  async selfcareUpsertTenant({
    tenantSeed,
    authData,
  }: {
    tenantSeed: ApiSelfcareTenantSeed;
    authData: AuthData;
  }): Promise<string> {
    const existingTenant = await readModelService.getTenantByExternalId(
      tenantSeed.externalId
    );
    if (existingTenant) {
      await assertResourceAllowed(existingTenant.data.id, authData);
      const tenantKind = await getTenantKindLoadingCertifiedAttributes(
        existingTenant.data.attributes,
        existingTenant.data.externalId
      );

      const updatedSelfcareId = evaluateNewSelfcareId({
        tenant: existingTenant.data,
        newSelfcareId: tenantSeed.selfcareId,
      });

      const updatedTenant: Tenant = {
        ...existingTenant.data,
        kind: tenantKind,
        selfcareId: updatedSelfcareId,
        updatedAt: new Date(),
      };

      return await repository.createEvent(
        toCreateEventTenantUpdated(
          existingTenant.data.id,
          existingTenant.metadata.version,
          updatedTenant
        )
      );
    } else {
      const newTenant: Tenant = {
        id: uuidv4(),
        name: tenantSeed.name,
        attributes: [],
        externalId: tenantSeed.externalId,
        features: [],
        mails: [],
        selfcareId: tenantSeed.selfcareId,
        kind: getTenantKind([], tenantSeed.externalId),
        createdAt: new Date(),
      };
      return await repository.createEvent(toCreateEventTenantAdded(newTenant));
    }
  },
};

function evaluateNewSelfcareId({
  tenant,
  newSelfcareId,
}: {
  tenant: Tenant;
  newSelfcareId: string;
}): string {
  if (!tenant.selfcareId) {
    return newSelfcareId;
  } else {
    if (tenant.selfcareId !== newSelfcareId) {
      throw selfcareIdConflict({
        tenantId: tenant.id,
        existingSelfcareId: tenant.selfcareId,
        newSelfcareId,
      });
    }
    return tenant.selfcareId;
  }
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

  const updatedTenant: Tenant = {
    ...tenant.data,
    attributes: updatedAttributes,
    updatedAt: new Date(),
  };

  return toCreateEventTenantUpdated(
    tenant.data.id,
    tenant.metadata.version,
    updatedTenant
  );
}

export async function updateTenantLogic({
  tenant,
  mailsSeed,
  kind,
}: {
  tenant: WithMetadata<Tenant>;
  mailsSeed: ApiTenantMailsSeed;
  kind: TenantKind;
}): Promise<CreateEvent<TenantEvent>> {
  const updatedTenant: Tenant = {
    ...tenant.data,
    mails: toTenantMails(mailsSeed),
    kind,
    updatedAt: new Date(),
  };

  return toCreateEventTenantUpdated(
    tenant.data.id,
    tenant.metadata.version,
    updatedTenant
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
