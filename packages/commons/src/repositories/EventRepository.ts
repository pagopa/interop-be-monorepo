import { CorrelationId, genericInternalError } from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { z } from "zod";
import { DB } from "./db.js";
import * as sql from "./sql/index.js";

export interface Event {
  readonly type: string;
  readonly event_version: number;
}

export type CreateEvent<T extends Event> = {
  readonly streamId: string;
  readonly correlationId: CorrelationId;
  readonly version: undefined | number;
  readonly event: T;
};

type CreatedEvent = {
  streamId: string;
  newVersion: number;
};

type CreatedEvents = {
  events: CreatedEvent[];
  latestVersion: number;
};

async function internalCreateEvents<T extends Event>(
  db: DB,
  toBinaryData: (event: T) => Uint8Array,
  createEvents: Array<CreateEvent<T>>
): Promise<CreatedEvent[]> {
  try {
    return await db.tx(async (t) => {
      const createdEvents = [];
      for (const createEvent of createEvents) {
        const dbRecord = await t.oneOrNone(sql.checkEventVersionExists, {
          stream_id: createEvent.streamId,
          version: createEvent.version,
        });
        const decodedDBRecord = z
          .object({ version: z.coerce.number() })
          .nullish()
          .safeParse(dbRecord);

        if (!decodedDBRecord.success) {
          throw genericInternalError(
            `Error checking version for stream ${createEvent.streamId}: ${decodedDBRecord.error.message}`
          );
        }

        const newVersion = match([
          decodedDBRecord.data?.version,
          createEvent.version,
        ])
          .with([P.nullish, P.nullish], () => 0)
          .with([P.number, P.number], ([_, version]) => version + 1)
          .with([P.nullish, P.number], () => {
            throw genericInternalError(
              `Cannot specify a version number for a new streamId ${createEvent.streamId}`
            );
          })
          .with([P.number, P.nullish], () => {
            throw genericInternalError(
              `A version number should be specified for an existing streamId ${createEvent.streamId}`
            );
          })
          .exhaustive();

        await t.none(sql.insertEvent, {
          stream_id: createEvent.streamId,
          version: newVersion,
          correlation_id: createEvent.correlationId,
          type: createEvent.event.type,
          event_version: createEvent.event.event_version,
          data: Buffer.from(toBinaryData(createEvent.event)),
        });

        // eslint-disable-next-line functional/immutable-data
        createdEvents.push({
          streamId: createEvent.streamId,
          newVersion,
        });
      }
      return createdEvents;
    });
  } catch (error) {
    throw genericInternalError(`Error creating event: ${error}`);
  }
}

async function internalCreateEventsV2<T extends Event>(
  db: DB,
  toBinaryData: (event: T) => Uint8Array,
  createEvents: Array<CreateEvent<T>>
): Promise<CreatedEvents> {
  try {
    const events = await internalCreateEvents(db, toBinaryData, createEvents);
    return {
      events,
      latestVersion: Math.max(0, ...events.map((e) => e.newVersion)),
    };
  } catch (error) {
    throw genericInternalError(`Error creating event: ${error}`);
  }
}

export const eventRepository = <T extends Event>(
  db: DB,
  toBinaryData: (event: T) => Uint8Array
): {
  createEvent: (createEvent: CreateEvent<T>) => Promise<CreatedEvent>;
  createEvents: (
    createEvents: Array<CreateEvent<T>>
  ) => Promise<CreatedEvent[]>;
  createEventsV2: (
    createEvents: Array<CreateEvent<T>>
  ) => Promise<CreatedEvents>;
} => ({
  async createEvent(createEvent: CreateEvent<T>): Promise<CreatedEvent> {
    return (await internalCreateEvents(db, toBinaryData, [createEvent]))[0];
  },
  async createEvents(
    createEvents: Array<CreateEvent<T>>
  ): Promise<CreatedEvent[]> {
    return await internalCreateEvents(db, toBinaryData, createEvents);
  },
  async createEventsV2(
    createEvents: Array<CreateEvent<T>>
  ): Promise<CreatedEvents> {
    return await internalCreateEventsV2(db, toBinaryData, createEvents);
  },
});

export type EventRepository = typeof eventRepository;
