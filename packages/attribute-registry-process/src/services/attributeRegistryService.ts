import {
  AuthData,
  CreateEvent,
  eventRepository,
  initDB,
} from "pagopa-interop-commons";
import {
  AttributeEvent,
  AttributeTmp,
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
import { apiAttributeKindToAttributeKind } from "../model/domain/apiConverter.js";
import { toCreateEventAttributeAdded } from "../model/domain/toEvent.js";
import { ReadModelService } from "./readModelService.js";

export class AttributeRegistryService {
  private readModelService: ReadModelService;
  private repository;
  constructor(readModelService?: ReadModelService, port?: number) {
    this.readModelService = readModelService || new ReadModelService();

    this.repository = eventRepository(
      initDB({
        username: config.eventStoreDbUsername,
        password: config.eventStoreDbPassword,
        host: config.eventStoreDbHost,
        port: port || config.eventStoreDbPort,
        database: config.eventStoreDbName,
        schema: config.eventStoreDbSchema,
        useSSL: config.eventStoreDbUseSSL,
      }),
      attributeEventToBinaryData
    );
  }

  public async createDeclaredAttribute(
    apiDeclaredAttributeSeed: ApiDeclaredAttributeSeed,
    authData: AuthData
  ): Promise<string> {
    if (authData.externalId.origin !== "IPA") {
      throw originNotCompliant("IPA");
    }

    return this.repository.createEvent(
      createDeclaredAttributeLogic({
        attribute: await this.readModelService.getAttributeByName(
          apiDeclaredAttributeSeed.name
        ),
        apiDeclaredAttributeSeed,
      })
    );
  }
  public async createVerifiedAttribute(
    apiVerifiedAttributeSeed: ApiVerifiedAttributeSeed,
    authData: AuthData
  ): Promise<string> {
    if (authData.externalId.origin !== "IPA") {
      throw originNotCompliant("IPA");
    }

    return this.repository.createEvent(
      createVerifiedAttributeLogic({
        attribute: await this.readModelService.getAttributeByName(
          apiVerifiedAttributeSeed.name
        ),
        apiVerifiedAttributeSeed,
      })
    );
  }
}

export function createDeclaredAttributeLogic({
  attribute,
  apiDeclaredAttributeSeed,
}: {
  attribute: WithMetadata<AttributeTmp> | undefined;
  apiDeclaredAttributeSeed: ApiDeclaredAttributeSeed;
}): CreateEvent<AttributeEvent> {
  if (attribute) {
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
  attribute,
  apiVerifiedAttributeSeed,
}: {
  attribute: WithMetadata<AttributeTmp> | undefined;
  apiVerifiedAttributeSeed: ApiVerifiedAttributeSeed;
}): CreateEvent<AttributeEvent> {
  if (attribute) {
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
