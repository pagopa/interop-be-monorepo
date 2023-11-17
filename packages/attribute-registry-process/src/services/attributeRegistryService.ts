import {
  AuthData,
  CreateEvent,
  eventRepository,
  initDB,
} from "pagopa-interop-commons";
import {
  AttributeEvent,
  Attribute,
  WithMetadata,
  attributeDuplicate,
  attributeEventToBinaryData,
  originNotCompliant,
  attributeKind,
  tenantIdNotFound,
  OrganizationIsNotACertifier,
} from "pagopa-interop-models";
import { v4 as uuidv4 } from "uuid";
import { config } from "../utilities/config.js";
import {
  ApiCertifiedAttributeSeed,
  ApiDeclaredAttributeSeed,
  ApiInternalCertifiedAttributeSeed,
  ApiVerifiedAttributeSeed,
} from "../model/types.js";
import { toCreateEventAttributeAdded } from "../model/domain/toEvent.js";
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
  attributeEventToBinaryData
);

export const attributeRegistryService = {
  async createDeclaredAttribute(
    apiDeclaredAttributeSeed: ApiDeclaredAttributeSeed,
    authData: AuthData
  ): Promise<string> {
    if (authData.externalId.origin !== "IPA") {
      throw originNotCompliant("IPA");
    }

    return repository.createEvent(
      createDeclaredAttributeLogic({
        attribute: await readModelService.getAttributeByName(
          apiDeclaredAttributeSeed.name
        ),
        apiDeclaredAttributeSeed,
      })
    );
  },
  async createVerifiedAttribute(
    apiVerifiedAttributeSeed: ApiVerifiedAttributeSeed,
    authData: AuthData
  ): Promise<string> {
    if (authData.externalId.origin !== "IPA") {
      throw originNotCompliant("IPA");
    }

    return repository.createEvent(
      createVerifiedAttributeLogic({
        attribute: await readModelService.getAttributeByName(
          apiVerifiedAttributeSeed.name
        ),
        apiVerifiedAttributeSeed,
      })
    );
  },
  async createCertifiedAttribute(
    apiCertifiedAttributeSeed: ApiCertifiedAttributeSeed,
    authData: AuthData
  ): Promise<string> {
    const certifierPromise = getCertifierId(authData.organizationId);
    const attributePromise = readModelService.getAttributeByCodeAndName(
      apiCertifiedAttributeSeed.code,
      apiCertifiedAttributeSeed.name
    );

    const [certifier, attribute] = await Promise.all([
      certifierPromise,
      attributePromise,
    ]);

    return repository.createEvent(
      createCertifiedAttributeLogic({
        attribute,
        apiCertifiedAttributeSeed,
        certifier,
      })
    );
  },
  async createInternalCertifiedAttribute(
    apiInternalCertifiedAttributeSeed: ApiInternalCertifiedAttributeSeed
  ): Promise<string> {
    return repository.createEvent(
      createInternalCertifiedAttributeLogic({
        attribute: await readModelService.getAttributeByCodeAndName(
          apiInternalCertifiedAttributeSeed.code,
          apiInternalCertifiedAttributeSeed.name
        ),
        apiInternalCertifiedAttributeSeed,
      })
    );
  },
};

export function createDeclaredAttributeLogic({
  attribute,
  apiDeclaredAttributeSeed,
}: {
  attribute: WithMetadata<Attribute> | undefined;
  apiDeclaredAttributeSeed: ApiDeclaredAttributeSeed;
}): CreateEvent<AttributeEvent> {
  if (attribute) {
    throw attributeDuplicate(apiDeclaredAttributeSeed.name);
  }

  const newDeclaredAttribute: Attribute = {
    id: uuidv4(),
    kind: attributeKind.declared,
    name: apiDeclaredAttributeSeed.name,
    description: apiDeclaredAttributeSeed.description,
    creationTime: new Date(),
    code: undefined,
    origin: undefined,
  };

  return toCreateEventAttributeAdded(newDeclaredAttribute);
}

export function createVerifiedAttributeLogic({
  attribute,
  apiVerifiedAttributeSeed,
}: {
  attribute: WithMetadata<Attribute> | undefined;
  apiVerifiedAttributeSeed: ApiVerifiedAttributeSeed;
}): CreateEvent<AttributeEvent> {
  if (attribute) {
    throw attributeDuplicate(apiVerifiedAttributeSeed.name);
  }

  const newVerifiedAttribute: Attribute = {
    id: uuidv4(),
    kind: attributeKind.verified,
    name: apiVerifiedAttributeSeed.name,
    description: apiVerifiedAttributeSeed.description,
    creationTime: new Date(),
    code: undefined,
    origin: undefined,
  };

  return toCreateEventAttributeAdded(newVerifiedAttribute);
}

export function createCertifiedAttributeLogic({
  attribute,
  apiCertifiedAttributeSeed,
  certifier,
}: {
  attribute: WithMetadata<Attribute> | undefined;
  apiCertifiedAttributeSeed: ApiCertifiedAttributeSeed;
  certifier: string;
}): CreateEvent<AttributeEvent> {
  if (attribute) {
    throw attributeDuplicate(apiCertifiedAttributeSeed.name);
  }

  const newCertifiedAttribute: Attribute = {
    id: uuidv4(),
    kind: attributeKind.certified,
    name: apiCertifiedAttributeSeed.name,
    description: apiCertifiedAttributeSeed.description,
    creationTime: new Date(),
    code: undefined,
    origin: certifier,
  };

  return toCreateEventAttributeAdded(newCertifiedAttribute);
}

async function getCertifierId(tenantId: string): Promise<string> {
  const tenant = await readModelService.getTenantById(tenantId);
  if (!tenant) {
    throw tenantIdNotFound(tenantId);
  }

  const certifier = tenant.data.features
    .filter(({ type }) => type === "Certifier")
    .find(({ certifierId }) => certifierId.trim().length > 0);

  if (certifier) {
    return certifier.certifierId;
  }
  throw OrganizationIsNotACertifier(tenantId);
}

export function createInternalCertifiedAttributeLogic({
  attribute,
  apiInternalCertifiedAttributeSeed,
}: {
  attribute: WithMetadata<Attribute> | undefined;
  apiInternalCertifiedAttributeSeed: ApiInternalCertifiedAttributeSeed;
}): CreateEvent<AttributeEvent> {
  if (attribute) {
    throw attributeDuplicate(apiInternalCertifiedAttributeSeed.name);
  }

  const newInternalCertifiedAttribute: Attribute = {
    id: uuidv4(),
    kind: attributeKind.certified,
    name: apiInternalCertifiedAttributeSeed.name,
    description: apiInternalCertifiedAttributeSeed.description,
    creationTime: new Date(),
    code: apiInternalCertifiedAttributeSeed.code,
    origin: apiInternalCertifiedAttributeSeed.origin,
  };

  return toCreateEventAttributeAdded(newInternalCertifiedAttribute);
}
