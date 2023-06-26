import { DB } from "./db.js";
import * as sql from "./sql/index.js";

export type CreateEvent<D, M> = {
  readonly streamId: string;
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
        const data: { max: number } = await t.one(sql.maxEventVersion, {
          stream_id: event.streamId,
        });

        const max: number = data.max != null ? data.max + 1 : 0;

        t.none(sql.insertEvent, {
          stream_id: event.streamId,
          version: max,
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
