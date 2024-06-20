import {
  Client,
  ClientId,
  TenantId,
  UserId,
  WithMetadata,
  authorizationEventToBinaryData,
  clientKind,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { DB, Logger, eventRepository } from "pagopa-interop-commons";
import { clientNotFound } from "../model/domain/errors.js";
import { ApiClientSeed } from "../model/domain/models.js";
import { toCreateEventClientAdded } from "../model/domain/toEvent.js";
import { ReadModelService } from "./readModelService.js";
import { isClientConsumer } from "./validators.js";

const retrieveClient = async (
  clientId: ClientId,
  readModelService: ReadModelService
): Promise<WithMetadata<Client>> => {
  const client = await readModelService.getClientById(clientId);
  if (!client) {
    throw clientNotFound(clientId);
  }
  return client;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function authorizationServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelService
) {
  const repository = eventRepository(
    dbInstance,
    authorizationEventToBinaryData
  );

  return {
    async getClientById(
      clientId: ClientId,
      organizationId: TenantId,
      logger: Logger
    ): Promise<{ client: Client; showUsers: boolean }> {
      logger.info(`Retrieving Client ${clientId}`);
      const client = await retrieveClient(clientId, readModelService);
      return {
        client: client.data,
        showUsers: isClientConsumer(client.data.consumerId, organizationId),
      };
    },

    async createConsumerClient({
      clientSeed,
      organizationId,
      correlationId,
      logger,
    }: {
      clientSeed: ApiClientSeed;
      organizationId: TenantId;
      correlationId: string;
      logger: Logger;
    }): Promise<{ client: Client; showUsers: boolean }> {
      logger.info(
        `Creating CONSUMER client ${clientSeed.name} for consumer ${organizationId}"`
      );
      const client: Client = {
        id: generateId(),
        consumerId: organizationId,
        name: clientSeed.name,
        purposes: [],
        description: clientSeed.description,
        kind: clientKind.consumer,
        users: clientSeed.members.map(unsafeBrandId<UserId>),
        createdAt: new Date(),
        keys: [],
      };

      await repository.createEvent(
        toCreateEventClientAdded(client, correlationId)
      );

      return {
        client,
        showUsers: true,
      };
    },
  };
}

export type AuthorizationService = ReturnType<
  typeof authorizationServiceBuilder
>;
