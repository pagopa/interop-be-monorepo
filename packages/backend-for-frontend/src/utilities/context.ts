import { IncomingHttpHeaders } from "http";
import { AppContext, WithLogger, logger } from "pagopa-interop-commons";
import { CorrelationId } from "pagopa-interop-models";

export type Headers = {
  "X-Correlation-Id": CorrelationId;
  Authorization: string | undefined;
  "X-Forwarded-For": string | undefined;
};

export type BffAppContext = AppContext & { headers: Headers };

export function fromBffAppContext(
  ctx: AppContext,
  headers: IncomingHttpHeaders
): WithLogger<BffAppContext> {
  return {
    ...ctx,
    headers: {
      "X-Correlation-Id": ctx.correlationId,
      Authorization: headers.authorization,
      "X-Forwarded-For": ctx.xForwardedForHeader,
    },
    logger: logger({ ...ctx }),
  };
}
