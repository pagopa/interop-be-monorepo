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
} from "pagopa-interop-models";
import { v4 as uuidv4 } from "uuid";
import { config } from "../utilities/config.js";
import {
  ApiDeclaredAttributeSeed,
  ApiVerifiedAttributeSeed,
} from "../model/types.js";
import { toAttributeKind } from "../model/domain/apiConverter.js";
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
    kind: toAttributeKind("DECLARED"),
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
    kind: toAttributeKind("VERIFIED"),
    name: apiVerifiedAttributeSeed.name,
    description: apiVerifiedAttributeSeed.description,
    creationTime: new Date(),
    code: undefined,
    origin: undefined,
  };

  return toCreateEventAttributeAdded(newVerifiedAttribute);
}
