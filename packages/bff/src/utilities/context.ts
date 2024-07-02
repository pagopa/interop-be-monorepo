import { IncomingHttpHeaders } from "http";
import { AppContext, WithLogger, logger } from "pagopa-interop-commons";
import { v4 as uuidv4 } from "uuid";

export type Headers = {
  "X-Correlation-Id": string;
  Authorization: string | undefined;
};

export type BffAppContext = AppContext & { headers: Headers };

export function fromBffAppContext(
  ctx: AppContext,
  headers: IncomingHttpHeaders
): WithLogger<BffAppContext> {
  const correlationId = uuidv4();
  return {
    ...ctx,
    correlationId, // override eventual correlationId provided in the BFF headers
    headers: {
      "X-Correlation-Id": correlationId,
      Authorization: headers.authorization,
    },
    logger: logger({ ...ctx }),
  };
}
