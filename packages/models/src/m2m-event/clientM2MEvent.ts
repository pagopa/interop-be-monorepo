import { z } from "zod";
import { ClientId, ClientM2MEventId, TenantId } from "../brandedIds.js";
import { AuthorizationEvent } from "../authorization/authorizationEvents.js";
import {
  m2mEventVisibility,
  M2MEventVisibility,
} from "./m2mEventVisibility.js";

export const ClientM2MEventType = z.enum([
  "ClientAdded",
  "ClientDeleted",
  "ClientPurposeAdded",
  "ClientPurposeRemoved",
]);
export type ClientM2MEventType = z.infer<typeof ClientM2MEventType>;

const _: AuthorizationEvent["type"] = {} as ClientM2MEventType;
// ^ Type check: ensure ClientM2MEventType options are a subset of AuthorizationEvent["type"].
//   This is required because Zod does not have an equivalent of TS Extract<...>.

void _; // avoid unused variable TS error, cannot use ts-ignore for a type check

export const ClientM2MEvent = z.object({
  id: ClientM2MEventId,
  eventType: ClientM2MEventType,
  eventTimestamp: z.coerce.date(),
  resourceVersion: z.number().int().min(0),
  clientId: ClientId,
  consumerId: TenantId,
  visibility: M2MEventVisibility.extract([
    m2mEventVisibility.owner,
    m2mEventVisibility.public,
    // No Client M2M events with Restricted visibility
  ]),
});

export type ClientM2MEvent = z.infer<typeof ClientM2MEvent>;
