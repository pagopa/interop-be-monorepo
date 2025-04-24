import { IncomingHttpHeaders } from "http";
import {
  AppContext,
  M2MAdminAuthData,
  M2MAuthData,
  WithLogger,
  logger,
} from "pagopa-interop-commons";
import { CorrelationId } from "pagopa-interop-models";

export type Headers = {
  "X-Correlation-Id": CorrelationId;
  Authorization: string | undefined;
  "X-Forwarded-For": string | undefined;
};

export type M2MGatewayAppContext<
  AuthData extends M2MAuthData | M2MAdminAuthData = M2MAuthData
> = AppContext<AuthData> & { headers: Headers };
/* ^ M2M Gateway can be called only with m2m or m2m-admin tokens.
This is enforced by the audience check during authentication,
and by the authorization validation in all routes. */

export function fromM2MGatewayAppContext(
  ctx: M2MGatewayAppContext,
  headers: IncomingHttpHeaders & { "x-forwarded-for"?: string }
): WithLogger<M2MGatewayAppContext> {
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
