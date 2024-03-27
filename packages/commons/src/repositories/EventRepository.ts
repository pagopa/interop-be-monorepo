import { logger } from "../index.js";
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

export const eventRepository = <T extends Event>(
  db: DB,
  toBinaryData: (event: T) => Uint8Array
): { createEvent: (createEvent: CreateEvent<T>) => Promise<string> } => ({
  async createEvent(createEvent: CreateEvent<T>): Promise<string> {
    try {
      return await db.tx(async (t) => {
        const data = await t.oneOrNone(sql.checkEventVersionExists, {
          stream_id: createEvent.streamId,
          version: createEvent.version,
        });

        const newVersion = data != null ? createEvent.version + 1 : 0;

        await t.none(sql.insertEvent, {
          stream_id: createEvent.streamId,
          correlation_id: createEvent.correlationId,
          version: newVersion,
          type: createEvent.event.type,
          event_version: createEvent.event.event_version,
          data: Buffer.from(toBinaryData(createEvent.event)),
        });

        return createEvent.streamId;
      });
    } catch (error) {
      logger.error(`Error creating event: ${error}`);
      throw error;
    }
  },
});

export type EventRepository = typeof eventRepository;
