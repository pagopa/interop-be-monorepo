import { CorrelationId, genericInternalError } from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { z } from "zod";
import { ITask } from "pg-promise";
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
  latestNewVersion: Map<CreatedEvent["streamId"], number>;
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
    throw genericInternalError(`Error creating event: ${error}`);
  }
}

async function internalCreateEvents<T extends Event>(
  db: DB,
  toBinaryData: (event: T) => Uint8Array,
  createEvents: Array<CreateEvent<T>>
): Promise<CreatedEvents> {
  const createdEvents: CreatedEvent[] = [];
  const latestNewVersion = new Map<string, number>();

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

        const currentMax = latestNewVersion.get(createdEvent.streamId) ?? -1;
        latestNewVersion.set(
          createdEvent.streamId,
          Math.max(currentMax, createdEvent.newVersion)
        );
      }
    });

    return {
      events: createdEvents,
      latestNewVersion,
    };
  } catch (error) {
    throw genericInternalError(`Error creating multiple events: ${error}`);
  }
}

export const eventRepository = <T extends Event>(
  db: DB,
  toBinaryData: (event: T) => Uint8Array
): {
  createEvent: (createEvent: CreateEvent<T>) => Promise<CreatedEvent>;
  createEvents: (createEvents: Array<CreateEvent<T>>) => Promise<CreatedEvents>;
} => ({
  async createEvent(createEvent: CreateEvent<T>): Promise<CreatedEvent> {
    return await internalCreateEvent(db, toBinaryData, createEvent);
  },
  async createEvents(
    createEvents: Array<CreateEvent<T>>
  ): Promise<CreatedEvents> {
    return await internalCreateEvents(db, toBinaryData, createEvents);
  },
});

export type EventRepository = typeof eventRepository;
