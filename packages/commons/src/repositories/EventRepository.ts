import { genericInternalError } from "pagopa-interop-models";
import { DB } from "./db.js";
import * as sql from "./sql/index.js";

export interface Event {
  readonly type: string;
  readonly event_version: number;
}

export type CreateEvent<T extends Event> = {
  readonly streamId: string;
  readonly correlationId: string;
  readonly version: number;
  readonly event: T;
};

async function internalCreateEvents<T extends Event>(
  db: DB,
  toBinaryData: (event: T) => Uint8Array,
  createEvents: Array<CreateEvent<T>>
): Promise<string[]> {
  try {
    await db.tx(async (t) => {
      for (const createEvent of createEvents) {
        const data = await t.oneOrNone(sql.checkEventVersionExists, {
          stream_id: createEvent.streamId,
          version: createEvent.version,
        });

        const newVersion = data != null ? createEvent.version + 1 : 0;

        await t.none(sql.insertEvent, {
          stream_id: createEvent.streamId,
          version: newVersion,
          correlation_id: createEvent.correlationId,
          type: createEvent.event.type,
          event_version: createEvent.event.event_version,
          data: Buffer.from(toBinaryData(createEvent.event)),
        });
      }
    });
    return createEvents.map((createEvent) => createEvent.streamId);
  } catch (error) {
    throw genericInternalError(`Error creating event: ${error}`);
  }
}

export const eventRepository = <T extends Event>(
  db: DB,
  toBinaryData: (event: T) => Uint8Array
): {
  createEvent: (createEvent: CreateEvent<T>) => Promise<string>;
  createEvents: (createEvents: Array<CreateEvent<T>>) => Promise<string[]>;
} => ({
  async createEvent(createEvent: CreateEvent<T>): Promise<string> {
    return (await internalCreateEvents(db, toBinaryData, [createEvent]))[0];
  },
  async createEvents(createEvents: Array<CreateEvent<T>>): Promise<string[]> {
    return await internalCreateEvents(db, toBinaryData, createEvents);
  },
});

export type EventRepository = typeof eventRepository;
