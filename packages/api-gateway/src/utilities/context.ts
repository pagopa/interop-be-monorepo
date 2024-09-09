import { IncomingHttpHeaders } from "http";
import { AppContext, WithLogger, logger } from "pagopa-interop-commons";

export type Headers = {
  "X-Correlation-Id": string;
  Authorization: string | undefined;
};

export type ApiGatewayAppContext = AppContext & { headers: Headers };

export function fromApiGatewayAppContext(
  ctx: AppContext,
  headers: IncomingHttpHeaders
): WithLogger<ApiGatewayAppContext> {
  return {
    ...ctx,
    headers: {
      "X-Correlation-Id": ctx.correlationId,
      Authorization: headers.authorization,
    },
    logger: logger({ ...ctx }),
  };
}
