import { DB } from "./db.js";
import * as sql from "./sql/index.js";

export type CreateEvent<D, M> = {
  readonly streamType: string;
  readonly type: string;
  readonly data: D;
  readonly meta: M;
};

export class EventRepository {
  private readonly db: DB;

  constructor(db: DB) {
    this.db = db;
  }

  public readonly createEvent: <D, M>(
    event: CreateEvent<D, M>
  ) => Promise<void> = async (event) => {
    const logTimestamp = new Date();

    try {
      await this.db.tx(async (t) => {
        const max: number =
          (await t.oneOrNone<number>(sql.maxEventVersion, {
            streamType: event.streamType,
          })) ?? 0;

        t.none(sql.insertEvent, {
          streamType: event.streamType,
          version: max + 1,
          type: event.type,
          data: event.data,
          meta: event.meta,
          log_date: logTimestamp,
        });
      });
    } catch (error) {
      console.error(error);
      throw error;
    }
  };
}
