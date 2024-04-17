/* eslint-disable functional/immutable-data */
import { zodiosContext } from "@zodios/express";
import { z } from "zod";
import { AuthData } from "../auth/authData.js";

export type AppContext = {
  authData: AuthData;
  messageData?: {
    eventType: string;
    eventVersion: number;
    streamId: string;
  };
  correlationId?: string | null | undefined;
};
export type ZodiosContext = NonNullable<typeof zodiosCtx>;
export type ExpressContext = NonNullable<typeof zodiosCtx.context>;

export const ctx = z.object({
  authData: AuthData,
  correlationId: z.string(),
});

export const zodiosCtx = zodiosContext(z.object({ ctx }));
