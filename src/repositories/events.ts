import { DB } from "./db.js";
import * as sql from "./sql/index.js";

export type CreateEvent<D> = {
  readonly streamId: string;
  readonly version: number;
  readonly type: string;
  readonly data: D;
};

export class EventRepository {
  private readonly db: DB;

  constructor(db: DB) {
    this.db = db;
  }

  public readonly createEvent: <D>(event: CreateEvent<D>) => Promise<void> =
    async (event) => {
      try {
        await this.db.tx(async (t) => {
          const data = await t.oneOrNone<{ version: number } | null>(
            sql.getEventVersion,
            {
              stream_id: event.streamId,
              version: event.version,
            }
          );

          const newVersion = data != null ? data.version + 1 : 0;

          await t.none(sql.insertEvent, {
            stream_id: event.streamId,
            version: newVersion,
            type: event.type,
            data: event.data,
          });
        });
      } catch (error) {
        console.error(error);
        throw error;
      }
    };
}
