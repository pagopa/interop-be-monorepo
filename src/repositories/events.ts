import * as Effect from "@effect/io/Effect";
import { logger } from "../utilities/logger.js";
import * as sql from "./sql/index.js";
import { DB } from "./db.js";

export type CreateEvent<D> = {
  readonly streamId: string;
  readonly version: number;
  readonly type: string;
  readonly data: D;
};

export const eventRepository = {
  createEvent<D>(event: CreateEvent<D>): Effect.Effect<DB, unknown, void> {
    return Effect.gen(function* (_) {
      const db = yield* _(DB);
      return Effect.tryCatchPromise(
        async () => {
          try {
            await db.tx(async (t) => {
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
            });
          } catch (error) {
            logger.error(error);
            throw error;
          }
        },
        (e) => e
      );
    });
  },
};
