import { randomInt } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMockClient,
  getMockKey,
  getMockProducerKeychain,
} from "pagopa-interop-commons-test";
import {
  AuthorizationEventEnvelopeV2,
  AuthorizationEventV2,
  toClientV2,
  ClientM2MEvent,
  KeyM2MEvent,
  ProducerKeychainM2MEvent,
  ProducerKeyM2MEvent,
  m2mEventVisibility,
  toProducerKeychainV2,
  generateId,
  Client,
  ProducerKeychain,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { handleAuthorizationEvent } from "../src/handlers/handleAuthorizationEvent.js";
import {
  getMockEventEnvelopeCommons,
  retrieveAllClientM2MEvents,
  retrieveAllKeyM2MEvents,
  retrieveAllProducerKeychainM2MEvents,
  retrieveAllProducerKeyM2MEvents,
  retrieveLastClientM2MEvent,
  retrieveLastKeyM2MEvent,
  retrieveLastProducerKeychainM2MEvent,
  retrieveLastProducerKeyM2MEvent,
  testM2mEventWriterService,
} from "./utils.js";

describe("handleAuthorizationEvent test", async () => {
  vi.spyOn(testM2mEventWriterService, "insertClientM2MEvent");
  vi.spyOn(testM2mEventWriterService, "insertKeyM2MEvent");
  vi.spyOn(testM2mEventWriterService, "insertProducerKeychainM2MEvent");
  vi.spyOn(testM2mEventWriterService, "insertProducerKeyM2MEvent");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe.each(AuthorizationEventV2.options.map((o) => o.shape.type.value))(
    "with event type %s",
    (eventType) => {
      it(`should write ${eventType} M2M event with the right visibility`, async () => {
        const eventTimestamp = new Date();

        const testCase = buildTestCaseData(eventTimestamp, eventType);

        await handleAuthorizationEvent(
          testCase.message,
          eventTimestamp,
          genericLogger,
          testM2mEventWriterService
        );

        await match(testCase)
          .with({ type: "not-handled" }, async () => {
            expect(
              testM2mEventWriterService.insertClientM2MEvent
            ).not.toHaveBeenCalled();
            expect(
              testM2mEventWriterService.insertProducerKeychainM2MEvent
            ).not.toHaveBeenCalled();
            expect(
              testM2mEventWriterService.insertKeyM2MEvent
            ).not.toHaveBeenCalled();
            expect(
              testM2mEventWriterService.insertProducerKeyM2MEvent
            ).not.toHaveBeenCalled();
          })
          .with({ type: "client" }, async ({ expectedM2MEvent }) => {
            expect(
              testM2mEventWriterService.insertClientM2MEvent
            ).toHaveBeenCalledTimes(1);
            const actualM2MEvent = await retrieveLastClientM2MEvent();
            expect(actualM2MEvent).toEqual(expectedM2MEvent);
            expect(
              testM2mEventWriterService.insertProducerKeychainM2MEvent
            ).not.toHaveBeenCalled();
            expect(
              testM2mEventWriterService.insertKeyM2MEvent
            ).not.toHaveBeenCalled();
            expect(
              testM2mEventWriterService.insertProducerKeyM2MEvent
            ).not.toHaveBeenCalled();
          })
          .with({ type: "producerKeychain" }, async ({ expectedM2MEvent }) => {
            expect(
              testM2mEventWriterService.insertClientM2MEvent
            ).not.toHaveBeenCalled();
            expect(
              testM2mEventWriterService.insertProducerKeychainM2MEvent
            ).toHaveBeenCalledTimes(1);
            const actualM2MEvent = await retrieveLastProducerKeychainM2MEvent();
            expect(actualM2MEvent).toEqual(expectedM2MEvent);
            expect(
              testM2mEventWriterService.insertKeyM2MEvent
            ).not.toHaveBeenCalled();
            expect(
              testM2mEventWriterService.insertProducerKeyM2MEvent
            ).not.toHaveBeenCalled();
          })
          .with({ type: "key" }, async ({ expectedM2MEvent }) => {
            expect(
              testM2mEventWriterService.insertClientM2MEvent
            ).not.toHaveBeenCalled();
            expect(
              testM2mEventWriterService.insertProducerKeychainM2MEvent
            ).not.toHaveBeenCalled();
            expect(
              testM2mEventWriterService.insertKeyM2MEvent
            ).toHaveBeenCalledTimes(1);
            const actualM2MEvent = await retrieveLastKeyM2MEvent();
            expect(actualM2MEvent).toEqual(expectedM2MEvent);
            expect(
              testM2mEventWriterService.insertProducerKeyM2MEvent
            ).not.toHaveBeenCalled();
          })
          .with({ type: "producerKey" }, async ({ expectedM2MEvent }) => {
            expect(
              testM2mEventWriterService.insertClientM2MEvent
            ).not.toHaveBeenCalled();
            expect(
              testM2mEventWriterService.insertProducerKeychainM2MEvent
            ).not.toHaveBeenCalled();
            expect(
              testM2mEventWriterService.insertKeyM2MEvent
            ).not.toHaveBeenCalled();
            expect(
              testM2mEventWriterService.insertProducerKeyM2MEvent
            ).toHaveBeenCalledTimes(1);
            const actualM2MEvent = await retrieveLastProducerKeyM2MEvent();
            expect(actualM2MEvent).toEqual(expectedM2MEvent);
          })
          .exhaustive();
      });

      it(`should not write the event ${eventType} if the same resource version is already present`, async () => {
        const testCase = buildTestCaseData(new Date(), eventType);

        const eventTimestamp = new Date();

        // Insert the event for the first time
        await handleAuthorizationEvent(
          testCase.message,
          eventTimestamp,
          genericLogger,
          testM2mEventWriterService
        );

        // Try to insert the same event again: should be skipped
        await handleAuthorizationEvent(
          testCase.message,
          eventTimestamp,
          genericLogger,
          testM2mEventWriterService
        );

        // Try to insert one with a further resource version: should be inserted
        await handleAuthorizationEvent(
          { ...testCase.message, version: testCase.message.version + 1 },
          eventTimestamp,
          genericLogger,
          testM2mEventWriterService
        );

        await match(testCase)
          .with({ type: "client" }, async () => {
            expect(
              testM2mEventWriterService.insertClientM2MEvent
            ).toHaveBeenCalledTimes(3);

            expect(await retrieveAllClientM2MEvents()).toHaveLength(2);
          })
          .with({ type: "producerKeychain" }, async () => {
            expect(
              testM2mEventWriterService.insertProducerKeychainM2MEvent
            ).toHaveBeenCalledTimes(3);

            expect(await retrieveAllProducerKeychainM2MEvents()).toHaveLength(
              2
            );
          })
          .with({ type: "key" }, async () => {
            expect(
              testM2mEventWriterService.insertKeyM2MEvent
            ).toHaveBeenCalledTimes(3);

            expect(await retrieveAllKeyM2MEvents()).toHaveLength(2);
          })
          .with({ type: "producerKey" }, async () => {
            expect(
              testM2mEventWriterService.insertProducerKeyM2MEvent
            ).toHaveBeenCalledTimes(3);

            expect(await retrieveAllProducerKeyM2MEvents()).toHaveLength(2);
          })
          .with({ type: "not-handled" }, async () => {
            expect(
              testM2mEventWriterService.insertClientM2MEvent
            ).not.toHaveBeenCalled();
            expect(
              testM2mEventWriterService.insertProducerKeychainM2MEvent
            ).not.toHaveBeenCalled();
            expect(
              testM2mEventWriterService.insertKeyM2MEvent
            ).not.toHaveBeenCalled();
            expect(
              testM2mEventWriterService.insertProducerKeyM2MEvent
            ).not.toHaveBeenCalled();
          })
          .exhaustive();
      });
    }
  );

  describe("cascading key deletion tests", () => {
    describe("ClientDeleted event", () => {
      it("should create cascading KeyDeleted M2M events when client is deleted", async () => {
        const numKeys = randomInt(1, 20);
        const keys = Array.from({ length: numKeys }, getMockKey);

        const client: Client = getMockClient({
          keys,
        });

        const eventTimestamp = new Date();

        const message = buildTestCaseData(eventTimestamp, "ClientDeleted", {
          client,
        }).message;

        await handleAuthorizationEvent(
          message,
          eventTimestamp,
          genericLogger,
          testM2mEventWriterService
        );

        // Verify client M2M event was created
        expect(
          testM2mEventWriterService.insertClientM2MEvent
        ).toHaveBeenCalledTimes(1);

        // Verify cascading key deletion events were created
        expect(
          testM2mEventWriterService.insertKeyM2MEvent
        ).toHaveBeenCalledTimes(numKeys);

        const keyCalls = vi.mocked(testM2mEventWriterService.insertKeyM2MEvent)
          .mock.calls;

        keys.forEach((key, index) => {
          expect(keyCalls[index][0]).toMatchObject({
            eventType: "ClientKeyDeleted",
            kid: key.kid,
          });
        });
      });

      it("should not create cascading events when client has no keys", async () => {
        const client: Client = getMockClient({
          keys: [],
        });

        const eventTimestamp = new Date();
        const message = buildTestCaseData(eventTimestamp, "ClientDeleted", {
          client,
        }).message;

        await handleAuthorizationEvent(
          message,
          eventTimestamp,
          genericLogger,
          testM2mEventWriterService
        );

        // Verify client M2M event was created
        expect(
          testM2mEventWriterService.insertClientM2MEvent
        ).toHaveBeenCalledTimes(1);

        // Verify no cascading key deletion events were created
        expect(
          testM2mEventWriterService.insertKeyM2MEvent
        ).not.toHaveBeenCalled();
      });
    });

    describe("ProducerKeychainDeleted event", () => {
      it("should create cascading ProducerKeyDeleted M2M events when producer keychain is deleted", async () => {
        const numKeys = randomInt(1, 20);
        const keys = Array.from({ length: numKeys }, getMockKey);

        const producerKeychain: ProducerKeychain = {
          ...getMockProducerKeychain(),
          keys,
        };

        const eventTimestamp = new Date();
        const message = buildTestCaseData(
          eventTimestamp,
          "ProducerKeychainDeleted",
          {
            producerKeychain,
          }
        ).message;

        await handleAuthorizationEvent(
          message,
          eventTimestamp,
          genericLogger,
          testM2mEventWriterService
        );

        // Verify producer keychain M2M event was created
        expect(
          testM2mEventWriterService.insertProducerKeychainM2MEvent
        ).toHaveBeenCalledTimes(1);

        // Verify cascading key deletion events were created
        expect(
          testM2mEventWriterService.insertProducerKeyM2MEvent
        ).toHaveBeenCalledTimes(numKeys);

        const keyCalls = vi.mocked(
          testM2mEventWriterService.insertProducerKeyM2MEvent
        ).mock.calls;

        keys.forEach((key, index) => {
          expect(keyCalls[index][0]).toMatchObject({
            eventType: "ProducerKeychainKeyDeleted",
            kid: key.kid,
          });
        });
      });

      it("should not create cascading events when producer keychain has no keys", async () => {
        const producerKeychain: ProducerKeychain = {
          ...getMockProducerKeychain(),
          keys: [],
        };

        const eventTimestamp = new Date();
        const message = buildTestCaseData(
          eventTimestamp,
          "ProducerKeychainDeleted",
          {
            producerKeychain,
          }
        ).message;

        await handleAuthorizationEvent(
          message,
          eventTimestamp,
          genericLogger,
          testM2mEventWriterService
        );

        // Verify producer keychain M2M event was created
        expect(
          testM2mEventWriterService.insertProducerKeychainM2MEvent
        ).toHaveBeenCalledTimes(1);

        // Verify no cascading producer key deletion events were created
        expect(
          testM2mEventWriterService.insertProducerKeyM2MEvent
        ).not.toHaveBeenCalled();
      });
    });
  });
});

function buildTestCaseData(
  eventTimestamp: Date,
  eventType: AuthorizationEventV2["type"],
  data?: {
    client?: Client;
    key?: { kid: string };
    producerKeychain?: ProducerKeychain;
    producerKey?: { kid: string };
  }
) {
  const client = data?.client ?? getMockClient();
  const key = data?.key ?? getMockKey();
  const producerKeychain = data?.producerKeychain ?? getMockProducerKeychain();
  const producerKey = data?.producerKey ?? getMockKey();

  return (
    match(eventType)
      .returnType<
        { message: AuthorizationEventEnvelopeV2 } & (
          | {
              type: "client";
              expectedM2MEvent: ClientM2MEvent;
            }
          | {
              type: "key";
              expectedM2MEvent: KeyM2MEvent;
            }
          | {
              type: "producerKeychain";
              expectedM2MEvent: ProducerKeychainM2MEvent;
            }
          | {
              type: "producerKey";
              expectedM2MEvent: ProducerKeyM2MEvent;
            }
          | {
              type: "not-handled";
              expectedM2MEvent: undefined;
            }
        )
      >()
      /**
       * Public Client events
       */
      .with(P.union("ClientAdded", "ClientDeleted"), (eventType) => ({
        message: {
          ...getMockEventEnvelopeCommons(),
          stream_id: client.id,
          type: eventType,
          version: 1,
          data: {
            client: toClientV2(client),
          },
        } as AuthorizationEventEnvelopeV2,
        expectedM2MEvent: {
          id: expect.any(String),
          eventType,
          eventTimestamp,
          resourceVersion: 1,
          clientId: client.id,
          consumerId: client.consumerId,
          visibility: m2mEventVisibility.public,
        },
        type: "client",
      }))
      /**
       * Owner Client events
       */
      .with(
        P.union("ClientPurposeAdded", "ClientPurposeRemoved"),
        (eventType) => ({
          message: {
            ...getMockEventEnvelopeCommons(),
            stream_id: client.id,
            type: eventType,
            version: 1,
            data: {
              client: toClientV2(client),
              purposeId: "purpose-123",
            },
          } as AuthorizationEventEnvelopeV2,
          expectedM2MEvent: {
            id: expect.any(String),
            eventType,
            eventTimestamp,
            resourceVersion: 1,
            clientId: client.id,
            consumerId: client.consumerId,
            visibility: m2mEventVisibility.owner,
          },
          type: "client",
        })
      )
      /**
       * Public Producer Keychain events
       */
      .with(
        P.union("ProducerKeychainAdded", "ProducerKeychainDeleted"),
        (eventType) => ({
          message: {
            ...getMockEventEnvelopeCommons(),
            stream_id: producerKeychain.id,
            type: eventType,
            version: 1,
            data: {
              producerKeychain: toProducerKeychainV2(producerKeychain),
              producerKeychainId: producerKeychain.id,
            },
          } as AuthorizationEventEnvelopeV2,
          expectedM2MEvent: {
            id: expect.any(String),
            eventType,
            eventTimestamp,
            resourceVersion: 1,
            producerKeychainId: producerKeychain.id,
            producerId: producerKeychain.producerId,
            visibility: m2mEventVisibility.public,
          },
          type: "producerKeychain",
        })
      )
      /**
       * Owner Producer Keychain events
       */
      .with(
        P.union(
          "ProducerKeychainEServiceAdded",
          "ProducerKeychainEServiceRemoved"
        ),
        (eventType) => ({
          message: {
            ...getMockEventEnvelopeCommons(),
            stream_id: producerKeychain.id,
            type: eventType,
            version: 1,
            data: {
              producerKeychain: toProducerKeychainV2(producerKeychain),
              producerKeychainId: producerKeychain.id,
              eserviceId: "eservice-123",
            },
          } as AuthorizationEventEnvelopeV2,
          expectedM2MEvent: {
            id: expect.any(String),
            eventType,
            eventTimestamp,
            resourceVersion: 1,
            producerKeychainId: producerKeychain.id,
            producerId: producerKeychain.producerId,
            visibility: m2mEventVisibility.owner,
          },
          type: "producerKeychain",
        })
      )
      /**
       * Key events
       */
      .with(P.union("ClientKeyAdded", "ClientKeyDeleted"), (eventType) => ({
        message: {
          ...getMockEventEnvelopeCommons(),
          stream_id: key.kid,
          type: eventType,
          version: 1,
          data: {
            kid: key.kid,
            client: toClientV2(client),
          },
        } as AuthorizationEventEnvelopeV2,
        expectedM2MEvent: {
          id: expect.any(String),
          eventType,
          eventTimestamp,
          resourceVersion: 1,
          kid: key.kid,
        },
        type: "key",
      }))
      /**
       * Producer Key events
       */
      .with(
        P.union("ProducerKeychainKeyAdded", "ProducerKeychainKeyDeleted"),
        (eventType) => ({
          message: {
            ...getMockEventEnvelopeCommons(),
            stream_id: producerKey.kid,
            type: eventType,
            version: 1,
            data: {
              kid: producerKey.kid,
              producerKeychain: toProducerKeychainV2(producerKeychain),
            },
          } as AuthorizationEventEnvelopeV2,
          expectedM2MEvent: {
            id: expect.any(String),
            eventType,
            eventTimestamp,
            resourceVersion: 1,
            kid: producerKey.kid,
          },
          type: "producerKey",
        })
      )
      /**
       * Not handled events
       */
      .with(
        P.union(
          "ClientUserAdded",
          "ClientUserDeleted",
          "ProducerKeychainUserAdded",
          "ProducerKeychainUserDeleted",
          "ClientAdminSet",
          "ClientAdminRoleRevoked",
          "ClientAdminRemoved"
        ),
        () => ({
          type: "not-handled",
          message: {
            ...getMockEventEnvelopeCommons(),
            stream_id: generateId(),
            type: eventType,
            version: 1,
            data: {},
          } as AuthorizationEventEnvelopeV2,
          expectedM2MEvent: undefined,
        })
      )
      .exhaustive()
  );
}
