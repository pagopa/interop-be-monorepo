import {
  AuthorizationEventEnvelope,
  AuthorizationEventEnvelopeV2,
  Client,
  fromClientV2,
  fromProducerKeychainV2,
  ProducerKeychain,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { M2MEventWriterServiceSQL } from "../services/m2mEventWriterServiceSQL.js";
import { toClientM2MEventSQL } from "../models/clientM2MEventAdapterSQL.js";
import { toKeyM2MEventSQL } from "../models/keyM2MEventAdapterSQL.js";
import { toProducerKeychainM2MEventSQL } from "../models/producerKeychainM2MEventAdapterSQL.js";
import { toProducerKeyM2MEventSQL } from "../models/producerKeyM2MEventAdapterSQL.js";
import {
  assertClientExistsInEvent,
  assertProducerKeychainExistsInEvent,
} from "../services/validators.js";
import { createProducerKeyM2MEvent } from "../services/event-builders/producerKeyM2MEventBuilder.js";
import { createKeyM2MEvent } from "../services/event-builders/keyM2MEventBuilder.js";
import { createClientM2MEvent } from "../services/event-builders/clientM2MEventBuilder.js";
import { createProducerKeychainM2MEvent } from "../services/event-builders/producerKeychainM2MEventBuilder.js";

export async function handleAuthorizationEvent(
  agreementEvent: AuthorizationEventEnvelope,
  eventTimestamp: Date,
  logger: Logger,
  m2mEventWriterService: M2MEventWriterServiceSQL
): Promise<void> {
  await match(agreementEvent)
    .with({ event_version: 1 }, () => Promise.resolve())
    .with({ event_version: 2 }, (msg) =>
      handleAuthorizationEventV2(
        msg,
        eventTimestamp,
        logger,
        m2mEventWriterService
      )
    )
    .exhaustive();
}

async function handleAuthorizationEventV2(
  decodedMessage: AuthorizationEventEnvelopeV2,
  eventTimestamp: Date,
  logger: Logger,
  m2mEventWriterService: M2MEventWriterServiceSQL
): Promise<void> {
  return (
    match(decodedMessage)
      .with(
        {
          /**
           * Handling client events
           */
          type: P.union(
            "ClientAdded",
            "ClientDeleted",
            "ClientPurposeAdded",
            "ClientPurposeRemoved"
          ),
        },
        async (event) => {
          assertClientExistsInEvent(event);
          const client = fromClientV2(event.data.client);

          logger.info(
            `Creating Client M2M Event - type ${event.type}, clientId ${client.id}`
          );

          const m2mEvent = createClientM2MEvent(
            client,
            event.version,
            event.type,
            eventTimestamp
          );

          /**
           * When a client is deleted, all its keys are also deleted but
           * no events are generated related to the keys. Therefore, we need to
           * manually create the related KeyDeleted M2M events here.
           */
          if (event.type === "ClientDeleted") {
            await handleClientCascadingKeyDeletions(
              client,
              event.version,
              eventTimestamp,
              m2mEventWriterService
            );
          }

          await m2mEventWriterService.insertClientM2MEvent(
            toClientM2MEventSQL(m2mEvent)
          );
        }
      )
      .with(
        {
          /**
           * Handling key events
           */
          type: P.union("ClientKeyAdded", "ClientKeyDeleted"),
        },
        async (event) => {
          assertClientExistsInEvent(event);
          const client = fromClientV2(event.data.client);
          logger.info(
            `Creating Key M2M Event - type ${event.type}, clientId ${event.data.kid}`
          );

          const m2mEvent = createKeyM2MEvent(
            client,
            event.data.kid,
            event.version,
            event.type,
            eventTimestamp
          );

          await m2mEventWriterService.insertKeyM2MEvent(
            toKeyM2MEventSQL(m2mEvent)
          );
        }
      )
      .with(
        {
          /**
           * Handling producer keychain events
           */
          type: P.union(
            "ProducerKeychainAdded",
            "ProducerKeychainDeleted",
            "ProducerKeychainEServiceAdded",
            "ProducerKeychainEServiceRemoved"
          ),
        },
        async (event) => {
          assertProducerKeychainExistsInEvent(event);
          const producerKeychain = fromProducerKeychainV2(
            event.data.producerKeychain
          );

          logger.info(
            `Creating Producer Keychain M2M Event - type ${event.type}, producerKeychainId ${producerKeychain.id}`
          );

          const m2mEvent = createProducerKeychainM2MEvent(
            producerKeychain,
            event.version,
            event.type,
            eventTimestamp
          );

          /**
           * When a producer keychain is deleted, all its keys are also deleted but
           * no events are generated related to the keys. Therefore, we need to
           * manually create the related ProducerKeyDeleted M2M events here.
           */
          if (event.type === "ProducerKeychainDeleted") {
            await handleProducerKeychainCascadingKeyDeletions(
              producerKeychain,
              event.version,
              eventTimestamp,
              m2mEventWriterService
            );
          }

          await m2mEventWriterService.insertProducerKeychainM2MEvent(
            toProducerKeychainM2MEventSQL(m2mEvent)
          );
        }
      )
      /**
       * Handling producer keychain key events
       */
      .with(
        {
          type: P.union(
            "ProducerKeychainKeyAdded",
            "ProducerKeychainKeyDeleted"
          ),
        },
        async (event) => {
          assertProducerKeychainExistsInEvent(event);
          const producerKeychain = fromProducerKeychainV2(
            event.data.producerKeychain
          );
          logger.info(
            `Creating Producer Key M2M Event - type ${event.type}, producerKeyId ${event.data.kid}`
          );

          const m2mEvent = createProducerKeyM2MEvent(
            producerKeychain,
            event.data.kid,
            event.version,
            event.type,
            eventTimestamp
          );

          await m2mEventWriterService.insertProducerKeyM2MEvent(
            toProducerKeyM2MEventSQL(m2mEvent)
          );
        }
      )
      .with(
        {
          /**
           * We avoid exposing the User-related events as M2M events because the
           * related apis are not exposed in the M2M API.
           */
          type: P.union(
            "ClientUserAdded",
            "ClientUserDeleted",
            "ProducerKeychainUserAdded",
            "ProducerKeychainUserDeleted",
            "ClientAdminSet",
            "ClientAdminRoleRevoked",
            "ClientAdminRemoved"
          ),
        },
        () => Promise.resolve(void 0)
      )
      .exhaustive()
  );
}

async function handleClientCascadingKeyDeletions(
  client: Client,
  resourceVersion: number,
  eventTimestamp: Date,
  m2mEventWriterService: M2MEventWriterServiceSQL
): Promise<void> {
  for (const key of client.keys) {
    const m2mEvent = createKeyM2MEvent(
      client,
      key.kid,
      resourceVersion,
      "ClientKeyDeleted",
      eventTimestamp
    );

    await m2mEventWriterService.insertKeyM2MEvent(toKeyM2MEventSQL(m2mEvent));
  }
}

async function handleProducerKeychainCascadingKeyDeletions(
  producerKeychain: ProducerKeychain,
  resourceVersion: number,
  eventTimestamp: Date,
  m2mEventWriterService: M2MEventWriterServiceSQL
): Promise<void> {
  for (const key of producerKeychain.keys) {
    const m2mEvent = createProducerKeyM2MEvent(
      producerKeychain,
      key.kid,
      resourceVersion,
      "ProducerKeychainKeyDeleted",
      eventTimestamp
    );

    await m2mEventWriterService.insertProducerKeyM2MEvent(
      toProducerKeyM2MEventSQL(m2mEvent)
    );
  }
}
