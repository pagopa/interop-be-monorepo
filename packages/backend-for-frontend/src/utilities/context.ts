import { IncomingHttpHeaders } from "http";
import {
  AppContext,
  UIAuthData,
  WithLogger,
  logger,
} from "pagopa-interop-commons";
import { CorrelationId } from "pagopa-interop-models";

export type Headers = {
  "X-Correlation-Id": CorrelationId;
  Authorization: string | undefined;
  "X-Forwarded-For": string | undefined;
};

export type BffAppContext = AppContext<UIAuthData> & {
  headers: Headers;
};
/* ^ BFF can be called only by UI, so we can use UIAuthData as auth data type.
This is enforced by the audience check during authentication and by the
dedicated BFF middleware that asserts that the auth data is of type UIAuthData. */

export function fromBffAppContext(
  ctx: BffAppContext,
  headers: IncomingHttpHeaders & { "x-forwarded-for"?: string }
): WithLogger<BffAppContext> {
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
