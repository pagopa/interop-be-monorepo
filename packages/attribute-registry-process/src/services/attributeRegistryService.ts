import {
  AuthData,
  CreateEvent,
  eventRepository,
  initDB,
} from "pagopa-interop-commons";
import {
  AttributeEvent,
  AttributeKind,
  AttributeTmp,
  ListResult,
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
import { apiAttributeKindToAttributeKind } from "../model/domain/apiConverter.js";
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
        attributes: await readModelService.getAttributes(
          {
            kinds: [AttributeKind.Enum.Declared],
            name: apiDeclaredAttributeSeed.name,
          },
          0,
          1
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
        attributes: await readModelService.getAttributes(
          {
            kinds: [AttributeKind.Enum.Verified],
            name: apiVerifiedAttributeSeed.name,
          },
          0,
          1
        ),
        apiVerifiedAttributeSeed,
      })
    );
  },
};

export function createDeclaredAttributeLogic({
  attributes,
  apiDeclaredAttributeSeed,
}: {
  attributes: ListResult<AttributeTmp>;
  apiDeclaredAttributeSeed: ApiDeclaredAttributeSeed;
}): CreateEvent<AttributeEvent> {
  if (attributes.results.length > 0) {
    throw attributeDuplicate(apiDeclaredAttributeSeed.name);
  }

  const newDeclaredAttribute: AttributeTmp = {
    id: uuidv4(),
    kind: apiAttributeKindToAttributeKind("DECLARED"),
    name: apiDeclaredAttributeSeed.name,
    description: apiDeclaredAttributeSeed.description,
    creationTime: new Date(),
    code: undefined,
    origin: undefined,
  };

  return toCreateEventAttributeAdded(newDeclaredAttribute);
}

export function createVerifiedAttributeLogic({
  attributes,
  apiVerifiedAttributeSeed,
}: {
  attributes: ListResult<AttributeTmp>;
  apiVerifiedAttributeSeed: ApiVerifiedAttributeSeed;
}): CreateEvent<AttributeEvent> {
  if (attributes.results.length > 0) {
    throw attributeDuplicate(apiVerifiedAttributeSeed.name);
  }

  const newVerifiedAttribute: AttributeTmp = {
    id: uuidv4(),
    kind: apiAttributeKindToAttributeKind("VERIFIED"),
    name: apiVerifiedAttributeSeed.name,
    description: apiVerifiedAttributeSeed.description,
    creationTime: new Date(),
    code: undefined,
    origin: undefined,
  };

  return toCreateEventAttributeAdded(newVerifiedAttribute);
}
