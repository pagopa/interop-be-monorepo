import { CreateEvent } from "pagopa-interop-commons";
import {
  AuthorizationEventV2,
  Client,
  UserId,
  toClientV2,
} from "pagopa-interop-models";

export function toCreateEventClientAdded(
  client: Client,
  correlationId: string
): CreateEvent<AuthorizationEventV2> {
  return {
    streamId: client.id,
    version: 0,
    event: {
      type: "ClientAdded",
      event_version: 2,
      data: {
        client: toClientV2(client),
      },
    },
    correlationId,
  };
}

export function toCreateEventClientDeleted(
  client: Client,
  version: number,
  correlationId: string
): CreateEvent<AuthorizationEventV2> {
  return {
    streamId: client.id,
    version,
    event: {
      type: "ClientDeleted",
      event_version: 2,
      data: {
        client: toClientV2(client),
        clientId: client.id,
      },
    },
    correlationId,
  };
}

export function toCreateEventClientUserDeleted(
  client: Client,
  userId: UserId,
  version: number,
  correlationId: string
): CreateEvent<AuthorizationEventV2> {
  return {
    streamId: client.id,
    version,
    event: {
      type: "ClientUserDeleted",
      event_version: 2,
      data: {
        client: toClientV2(client),
        userId,
      },
    },
    correlationId,
  };
}

export function toCreateEventClientKeyDeleted(
  client: Client,
  keyId: string,
  version: number,
  correlationId: string
): CreateEvent<AuthorizationEventV2> {
  return {
    streamId: client.id,
    version,
    event: {
      type: "ClientKeyDeleted",
      event_version: 2,
      data: {
        client: toClientV2(client),
        kid: keyId,
      },
    },
    correlationId,
  };
}
