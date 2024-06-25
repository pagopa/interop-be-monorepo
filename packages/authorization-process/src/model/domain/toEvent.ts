import { CreateEvent } from "pagopa-interop-commons";
import {
  AuthorizationEventV2,
  Client,
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
