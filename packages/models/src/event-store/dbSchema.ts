import { z } from "zod";

export type ReadEvent<T extends Event> = {
  stream_id: string;
  version: string;
  type: T["type"];
  event_version: number;
  data: Uint8Array;
};

export const eventStoreSchema = {
  agreement: "agreement",
  attribute: "attribute",
  catalog: "catalog",
  tenant: "tenant",
  purpose: "purpose",
} as const;

export const EventStoreSchema = z.enum([
  Object.values(eventStoreSchema)[0],
  ...Object.values(eventStoreSchema).slice(1),
]);
export type EventStoreSchema = z.infer<typeof EventStoreSchema>;
