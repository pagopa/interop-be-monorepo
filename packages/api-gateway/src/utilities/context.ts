import { IncomingHttpHeaders } from "http";
import { AppContext, WithLogger, logger } from "pagopa-interop-commons";
import { CorrelationId } from "pagopa-interop-models";

export type Headers = {
  "X-Correlation-Id": CorrelationId;
  Authorization: string | undefined;
  "X-Forwarded-For": string | undefined;
};

export type ApiGatewayAppContext = AppContext & { headers: Headers };

export function fromApiGatewayAppContext(
  ctx: AppContext,
  headers: IncomingHttpHeaders & { "x-forwarded-for"?: string }
): WithLogger<ApiGatewayAppContext> {
  return {
    ...ctx,
    headers: {
      "X-Correlation-Id": ctx.correlationId,
      Authorization: headers.authorization,
      "X-Forwarded-For": headers["x-forwarded-for"],
    },
    logger: logger({ ...ctx }),
  };
}
