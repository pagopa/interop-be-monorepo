import { IncomingHttpHeaders } from "http";
import { AppContext, WithLogger, logger } from "pagopa-interop-commons";
import { Headers } from "../providers/clientProvider.js";

export type BffAppContext = AppContext & { headers: Headers };

export function fromBffAppContext(
  ctx: AppContext,
  headers: IncomingHttpHeaders
): WithLogger<BffAppContext> {
  return {
    ...ctx,
    headers: {
      "X-Correlation-Id": ctx.correlationId,
      Authorization: headers.authorization as string,
    },
    logger: logger({ ...ctx }),
  };
}
