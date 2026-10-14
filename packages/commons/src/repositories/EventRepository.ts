import {
  CorrelationId,
  eventConflictError,
  genericInternalError,
  PG_DUPLICATE_KEY_ERROR,
} from "pagopa-interop-models";
import { ITask } from "pg-promise";
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
  latestNewVersions: Map<CreatedEvent["streamId"], number>;
};

export type LastEvent<T extends Event> = {
  version: number;
  event: T;
};

async function insertEventInTransaction<T extends Event>(
  t: ITask<unknown>,
  toBinaryData: (event: T) => Uint8Array,
  createEvent: CreateEvent<T>
): Promise<CreatedEvent> {
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

  const newVersion = match([decodedDBRecord.data?.version, createEvent.version])
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

  return {
    streamId: createEvent.streamId,
    newVersion,
  };
}

async function internalCreateEvent<T extends Event>(
  db: DB,
  toBinaryData: (event: T) => Uint8Array,
  createEvent: CreateEvent<T>
): Promise<CreatedEvent> {
  try {
    return await db.tx(
      async (t) => await insertEventInTransaction(t, toBinaryData, createEvent)
    );
  } catch (error) {
    const e = error as { code?: string; constraint?: string };

    if (
      e?.code &&
      e.code === PG_DUPLICATE_KEY_ERROR &&
      e.constraint === "events_stream_id_version_key"
    ) {
      throw eventConflictError(
        createEvent.correlationId,
        createEvent?.streamId,
        createEvent?.version
      );
    }

    throw genericInternalError(`Error creating event: ${error}`);
  }
}

async function internalCreateEvents<T extends Event>(
  db: DB,
  toBinaryData: (event: T) => Uint8Array,
  createEvents: Array<CreateEvent<T>>
): Promise<CreatedEvents> {
  const createdEvents: CreatedEvent[] = [];
  const latestNewVersions = new Map<string, number>();

  let lastProcessedItemIndex = 0;
  try {
    await db.tx(async (t) => {
      for (const createEvent of createEvents) {
        const createdEvent = await insertEventInTransaction(
          t,
          toBinaryData,
          createEvent
        );
        // eslint-disable-next-line functional/immutable-data
        createdEvents.push(createdEvent);

        latestNewVersions.set(createdEvent.streamId, createdEvent.newVersion);

        lastProcessedItemIndex++;
      }
    });

    return {
      events: createdEvents,
      latestNewVersions,
    };
  } catch (error) {
    const e = error as { code?: string; constraint?: string };

    if (
      e?.code &&
      e.code === PG_DUPLICATE_KEY_ERROR &&
      e.constraint === "events_stream_id_version_key"
    ) {
      const lastEvent = createEvents[lastProcessedItemIndex];
      throw eventConflictError(
        lastEvent.correlationId,
        lastEvent.streamId,
        lastEvent.version
      );
    }

    throw genericInternalError(`Error creating multiple events: ${error}`);
  }
}

async function internalReadLastEvent<T extends Event>(
  db: DB,
  streamId: string,
  eventSchema: z.ZodType<T, z.ZodTypeDef, unknown>
): Promise<LastEvent<T> | undefined> {
  const dbRecord = await db.oneOrNone(sql.readLastEvent, {
    stream_id: streamId,
  });

  if (!dbRecord) {
    return undefined;
  }

  const decodedVersion = z.coerce.number().safeParse(dbRecord.version);
  if (!decodedVersion.success) {
    throw genericInternalError(
      `Error reading last event version for stream ${streamId}: ${decodedVersion.error.message}`
    );
  }

  const decodedEvent = eventSchema.safeParse(dbRecord);
  if (!decodedEvent.success) {
    throw genericInternalError(
      `Error decoding last event for stream ${streamId}: ${decodedEvent.error.message}`
    );
  }

  return { version: decodedVersion.data, event: decodedEvent.data };
}

export const eventRepository = <T extends Event>(
  db: DB,
  toBinaryData: (event: T) => Uint8Array
): {
  createEvent: (createEvent: CreateEvent<T>) => Promise<CreatedEvent>;
  createEvents: (createEvents: Array<CreateEvent<T>>) => Promise<CreatedEvents>;
  /**
   * Reads the last event of a stream directly from the event store.
   *
   * NOTE: process services usually read aggregates from the read model, which is
   * updated asynchronously and can miss the events written a few seconds earlier.
   * Use this function when a decision must be taken on the up-to-date aggregate
   * state, for example in recomputations triggered by asynchronous consumers:
   * deciding on a stale read model state can silently skip a required event
   * (see PIN-11081). The returned version is the one to use as expected version
   * when writing the next event of the stream.
   */
  readLastEvent: (
    streamId: string,
    eventSchema: z.ZodType<T, z.ZodTypeDef, unknown>
  ) => Promise<LastEvent<T> | undefined>;
} => ({
  async createEvent(createEvent: CreateEvent<T>): Promise<CreatedEvent> {
    return await internalCreateEvent(db, toBinaryData, createEvent);
  },
  async createEvents(
    createEvents: Array<CreateEvent<T>>
  ): Promise<CreatedEvents> {
    return await internalCreateEvents(db, toBinaryData, createEvents);
  },
  async readLastEvent(
    streamId: string,
    eventSchema: z.ZodType<T, z.ZodTypeDef, unknown>
  ): Promise<LastEvent<T> | undefined> {
    return await internalReadLastEvent(db, streamId, eventSchema);
  },
});

export type EventRepository = typeof eventRepository;
