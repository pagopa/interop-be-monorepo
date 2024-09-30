import { IncomingHttpHeaders } from "http";
import { AppContext, WithLogger, logger } from "pagopa-interop-commons";

export type Headers = {
  "X-Correlation-Id": string;
  Authorization: string | undefined;
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
    },
    logger: logger({ ...ctx }),
  };
}
