import { logger } from "../utilities/logger.js";
import { db } from "./db.js";
import * as sql from "./sql/index.js";

export type CreateEvent<D> = {
  readonly streamId: string;
  readonly version: number;
  readonly type: string;
  readonly data: D;
};

export const eventRepository = {
  async createEvent<D>(event: CreateEvent<D>): Promise<string> {
    try {
      return await db.tx(async (t) => {
        const data = await t.oneOrNone(sql.checkEventVersionExists, {
          stream_id: event.streamId,
          version: event.version,
        });

        const newVersion = data != null ? event.version + 1 : 0;

        await t.none(sql.insertEvent, {
          stream_id: event.streamId,
          version: newVersion,
          type: event.type,
          data: event.data,
        });

        return event.streamId;
      });
    } catch (error) {
      logger.error(error);
      throw error;
    }
  },
};
