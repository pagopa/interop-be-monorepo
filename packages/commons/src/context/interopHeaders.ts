import { CorrelationId } from "pagopa-interop-models";
import { z } from "zod";
import { CORRELATION_ID_HEADER } from "../auth/headers.js";

export const InteropHeaders = z.object({
  [CORRELATION_ID_HEADER]: CorrelationId,
  Authorization: z.string(),
});

export type InteropHeaders = z.infer<typeof InteropHeaders>;

export const getInteropHeaders = ({
  token,
  correlationId,
}: {
  token: string;
  correlationId: CorrelationId;
}): InteropHeaders => ({
  [CORRELATION_ID_HEADER]: correlationId,
  Authorization: `Bearer ${token}`,
});
