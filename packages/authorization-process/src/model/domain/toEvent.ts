import { CreateEvent } from "pagopa-interop-commons";
import {
  AuthorizationEventV2,
  Client,
  CorrelationId,
  EServiceId,
  ProducerKeychain,
  PurposeId,
  UserId,
  toClientV2,
  toProducerKeychainV2,
} from "pagopa-interop-models";

export function toCreateEventClientAdded(
  client: Client,
  correlationId: CorrelationId
): CreateEvent<AuthorizationEventV2> {
  return {
    streamId: client.id,
    version: undefined,
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
  correlationId: CorrelationId
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
  correlationId: CorrelationId
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
  correlationId: CorrelationId
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

export function toCreateEventClientPurposeRemoved(
  client: Client,
  purposeId: PurposeId,
  version: number,
  correlationId: CorrelationId
): CreateEvent<AuthorizationEventV2> {
  return {
    streamId: client.id,
    version,
    event: {
      type: "ClientPurposeRemoved",
      event_version: 2,
      data: {
        client: toClientV2(client),
        purposeId,
      },
    },
    correlationId,
  };
}

export function toCreateEventClientUserAdded(
  userId: UserId,
  client: Client,
  version: number,
  correlationId: CorrelationId
): CreateEvent<AuthorizationEventV2> {
  return {
    streamId: client.id,
    version,
    event: {
      type: "ClientUserAdded",
      event_version: 2,
      data: {
        client: toClientV2(client),
        userId,
      },
    },
    correlationId,
  };
}

export function toCreateEventClientPurposeAdded(
  purposeId: PurposeId,
  client: Client,
  version: number,
  correlationId: CorrelationId
): CreateEvent<AuthorizationEventV2> {
  return {
    streamId: client.id,
    version,
    event: {
      type: "ClientPurposeAdded",
      event_version: 2,
      data: {
        client: toClientV2(client),
        purposeId,
      },
    },
    correlationId,
  };
}

export function toCreateEventKeyAdded(
  kid: string,
  client: Client,
  version: number,
  correlationId: CorrelationId
): CreateEvent<AuthorizationEventV2> {
  return {
    streamId: client.id,
    version,
    event: {
      type: "ClientKeyAdded",
      event_version: 2,
      data: {
        client: toClientV2(client),
        kid,
      },
    },
    correlationId,
  };
}

export function toCreateEventProducerKeychainAdded(
  producerKeychain: ProducerKeychain,
  correlationId: CorrelationId
): CreateEvent<AuthorizationEventV2> {
  return {
    streamId: producerKeychain.id,
    version: undefined,
    event: {
      type: "ProducerKeychainAdded",
      event_version: 2,
      data: {
        producerKeychain: toProducerKeychainV2(producerKeychain),
      },
    },
    correlationId,
  };
}

export function toCreateEventProducerKeychainDeleted(
  producerKeychain: ProducerKeychain,
  version: number,
  correlationId: CorrelationId
): CreateEvent<AuthorizationEventV2> {
  return {
    streamId: producerKeychain.id,
    version,
    event: {
      type: "ProducerKeychainDeleted",
      event_version: 2,
      data: {
        producerKeychain: toProducerKeychainV2(producerKeychain),
        producerKeychainId: producerKeychain.id,
      },
    },
    correlationId,
  };
}

export function toCreateEventProducerKeychainUserAdded(
  userId: UserId,
  producerKeychain: ProducerKeychain,
  version: number,
  correlationId: CorrelationId
): CreateEvent<AuthorizationEventV2> {
  return {
    streamId: producerKeychain.id,
    version,
    event: {
      type: "ProducerKeychainUserAdded",
      event_version: 2,
      data: {
        producerKeychain: toProducerKeychainV2(producerKeychain),
        userId,
      },
    },
    correlationId,
  };
}

export function toCreateEventProducerKeychainUserDeleted(
  producerKeychain: ProducerKeychain,
  userId: UserId,
  version: number,
  correlationId: CorrelationId
): CreateEvent<AuthorizationEventV2> {
  return {
    streamId: producerKeychain.id,
    version,
    event: {
      type: "ProducerKeychainUserDeleted",
      event_version: 2,
      data: {
        producerKeychain: toProducerKeychainV2(producerKeychain),
        userId,
      },
    },
    correlationId,
  };
}

export function toCreateEventProducerKeychainKeyAdded(
  kid: string,
  producerKeychain: ProducerKeychain,
  version: number,
  correlationId: CorrelationId
): CreateEvent<AuthorizationEventV2> {
  return {
    streamId: producerKeychain.id,
    version,
    event: {
      type: "ProducerKeychainKeyAdded",
      event_version: 2,
      data: {
        kid,
        producerKeychain: toProducerKeychainV2(producerKeychain),
      },
    },
    correlationId,
  };
}

export function toCreateEventProducerKeychainKeyDeleted(
  producerKeychain: ProducerKeychain,
  keyId: string,
  version: number,
  correlationId: CorrelationId
): CreateEvent<AuthorizationEventV2> {
  return {
    streamId: producerKeychain.id,
    version,
    event: {
      type: "ProducerKeychainKeyDeleted",
      event_version: 2,
      data: {
        kid: keyId,
        producerKeychain: toProducerKeychainV2(producerKeychain),
      },
    },
    correlationId,
  };
}

export function toCreateEventProducerKeychainEServiceAdded(
  eserviceId: EServiceId,
  producerKeychain: ProducerKeychain,
  version: number,
  correlationId: CorrelationId
): CreateEvent<AuthorizationEventV2> {
  return {
    streamId: producerKeychain.id,
    version,
    event: {
      type: "ProducerKeychainEServiceAdded",
      event_version: 2,
      data: {
        eserviceId,
        producerKeychain: toProducerKeychainV2(producerKeychain),
      },
    },
    correlationId,
  };
}

export function toCreateEventProducerKeychainEServiceRemoved(
  producerKeychain: ProducerKeychain,
  eserviceId: EServiceId,
  version: number,
  correlationId: CorrelationId
): CreateEvent<AuthorizationEventV2> {
  return {
    streamId: producerKeychain.id,
    version,
    event: {
      type: "ProducerKeychainEServiceRemoved",
      event_version: 2,
      data: {
        eserviceId,
        producerKeychain: toProducerKeychainV2(producerKeychain),
      },
    },
    correlationId,
  };
}
