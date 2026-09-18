import { IncomingHttpHeaders } from "http";
import {
  AppContext,
  AuthData,
  WithLogger,
  logger,
  CORRELATION_ID_HEADER,
} from "pagopa-interop-commons";
import { CorrelationId } from "pagopa-interop-models";

type Headers = {
  [CORRELATION_ID_HEADER]: CorrelationId;
  Authorization: string | undefined;
  "X-Forwarded-For": string | undefined;
};

export type ApiGatewayAppContext<A extends AuthData = AuthData> =
  AppContext<A> & {
    headers: Headers;
  };

export function fromApiGatewayAppContext(
  ctx: ApiGatewayAppContext,
  headers: IncomingHttpHeaders & { "x-forwarded-for"?: string }
): WithLogger<ApiGatewayAppContext> {
  return {
    ...ctx,
    headers: {
      [CORRELATION_ID_HEADER]: ctx.correlationId,
      Authorization: headers.authorization,
      "X-Forwarded-For": headers["x-forwarded-for"],
    },
    logger: logger({ ...ctx }),
  };
}
