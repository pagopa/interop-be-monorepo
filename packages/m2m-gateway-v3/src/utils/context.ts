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
  A extends M2MAuthData | M2MAdminAuthData = M2MAdminAuthData,
> = AppContext<A> & { headers: Headers };
/* ^ M2M Gateway can be called only with m2m or m2m-admin tokens.
This is enforced by the audience check during authentication, and by the
dedicated middleware that asserts that the auth data is one of these two. */

export function fromM2MGatewayAppContext(
  ctx: M2MGatewayAppContext,
  headers: IncomingHttpHeaders & { "x-forwarded-for"?: string }
): WithLogger<M2MGatewayAppContext> {
  return {
    ...ctx,
    headers: getInteropHeaders(ctx, headers),
    logger: logger({ ...ctx }),
  };
}

export function getInteropHeaders(
  ctx: AppContext,
  headers: IncomingHttpHeaders & { "x-forwarded-for"?: string }
): Headers {
  const rawAuthorization = headers.authorization;
  const dpopPrefix = "dpop";
  const authorization = rawAuthorization?.toLowerCase().startsWith(dpopPrefix)
    ? "Bearer" + rawAuthorization.slice(dpopPrefix.length)
    : rawAuthorization;
  return {
    "X-Correlation-Id": ctx.correlationId,
    Authorization: authorization,
    "X-Forwarded-For": headers["x-forwarded-for"],
  };
}
