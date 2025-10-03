import { z } from "zod";

/*
M2M Event Visibility options:
- Public: event visible to all Tenants
    - Published E-Service events
    - Published Template events
    - etc.
- Owner: event visible only to the Tenant owner of the resource, or to its Delegate (if any)
    - The Producer/ProducerDelegate in case of Draft E-Service events
    - The Consumer/ConsumerDelegate in case of Draft Purpose/Agreement events
    - The Creator in case of Draft Template events
    - etc.
- Restricted: event visible only to a specific set of Tenants
    - The Producer/Consumer/Delegates in case of non-Draft Agreement/Purpose events
*/

export const m2mEventVisibility = {
  public: "Public",
  owner: "Owner",
  restricted: "Restricted",
} as const;
export const M2MEventVisibility = z.enum([
  Object.values(m2mEventVisibility)[0],
  ...Object.values(m2mEventVisibility).slice(1),
]);
export type M2MEventVisibility = z.infer<typeof M2MEventVisibility>;
