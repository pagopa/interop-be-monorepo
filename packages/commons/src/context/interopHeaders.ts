import { z } from "zod";

export const InteropHeaders = z.object({
  "X-Correlation-Id": z.string(),
  Authorization: z.string(),
});

export type InteropHeaders = z.infer<typeof InteropHeaders>;

export const getInteropHeaders = ({
  token,
  correlationId,
}: {
  token: string;
  correlationId: string;
}): InteropHeaders => ({
  "X-Correlation-Id": correlationId,
  Authorization: `Bearer ${token}`,
});
