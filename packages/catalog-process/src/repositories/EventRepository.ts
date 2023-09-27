import { logger } from "pagopa-interop-commons";
import { EServiceEvent, toBinaryData } from "pagopa-interop-models";
import { db } from "./db.js";
import * as sql from "./sql/index.js";

export type CreateEvent = {
  readonly streamId: string;
  readonly version: number;
  readonly event: EServiceEvent;
};

export const eventRepository = {
  async createEvent(createEvent: CreateEvent): Promise<string> {
    try {
      return await db.tx(async (t) => {
        const data = await t.oneOrNone(sql.checkEventVersionExists, {
          stream_id: createEvent.streamId,
          version: createEvent.version,
        });

        const newVersion = data != null ? createEvent.version + 1 : 0;

        await t.none(sql.insertEvent, {
          stream_id: createEvent.streamId,
          version: newVersion,
          type: createEvent.event.type,
          data: Buffer.from(toBinaryData(createEvent.event)),
        });

        return createEvent.streamId;
      });
    } catch (error) {
      logger.error(`Error creating event: ${error}`);
      throw error;
    }
  },
};
