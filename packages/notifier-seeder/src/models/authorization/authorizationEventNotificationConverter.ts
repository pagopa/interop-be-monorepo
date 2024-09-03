import {
  AuthorizationEventEnvelopeV2,
  fromKeyV2,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  AuthorizationEventNotification,
  KeyDeletedNotification,
  KeysAddedNotification,
} from "./authorizationEventNotification.js";
import { toKeyV1Notification } from "./authorizationEventNotificationMappers.js";

export const toAuthorizationEventNotification = (
  event: AuthorizationEventEnvelopeV2
): AuthorizationEventNotification | undefined =>
  match(event)
    .with({ type: "ClientKeyAdded" }, (event): KeysAddedNotification => {
      if (!event.data.client) {
        throw missingKafkaMessageDataError("client", event.type);
      }
      const key = event.data.client.keys.find(
        (key) => event.data.kid === key.kid
      );
      if (!key) {
        throw missingKafkaMessageDataError("key", event.type);
      }

      const keyV2 = fromKeyV2(key);
      return {
        clientId: event.data.client.id,
        keys: {
          [keyV2.kid]: toKeyV1Notification(keyV2),
        },
      };
    })
    .with({ type: "ClientKeyDeleted" }, (event): KeyDeletedNotification => {
      if (!event.data.client) {
        throw missingKafkaMessageDataError("client", event.type);
      }
      return {
        clientId: event.data.client.id,
        keyId: event.data.kid,
        deactivationTimestamp: new Date().toISOString(),
      };
    })
    .with(
      { type: "ClientAdded" },
      { type: "ClientDeleted" },
      { type: "ClientUserAdded" },
      { type: "ClientUserDeleted" },
      { type: "ClientPurposeAdded" },
      { type: "ClientPurposeRemoved" },
      { type: "ProducerKeychainAdded" },
      { type: "ProducerKeychainDeleted" },
      { type: "ProducerKeychainKeyAdded" },
      { type: "ProducerKeychainKeyDeleted" },
      { type: "ProducerKeychainUserAdded" },
      { type: "ProducerKeychainUserDeleted" },
      { type: "ProducerKeychainEServiceAdded" },
      { type: "ProducerKeychainEServiceRemoved" },
      () => undefined
    )
    .exhaustive();
