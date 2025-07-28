import { BaseUsersEventPayload } from "pagopa-interop-models";
import { z } from "zod";

export const UsersEventPayload = BaseUsersEventPayload;
export type UsersEventPayload = z.infer<typeof UsersEventPayload>;
