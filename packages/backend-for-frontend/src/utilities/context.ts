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

export function fromBffAppContext(
  ctx: AppContext,
  headers: IncomingHttpHeaders & { "x-forwarded-for"?: string }
): WithLogger<BffAppContext> {
  return {
    ...(ctx as AppContext<UIAuthData>),
    // ^ BFF is called only with UIAuthData and this is enforced
    // by the audience validation + a dedicated middleware checking user roles
    headers: {
      "X-Correlation-Id": ctx.correlationId,
      Authorization: headers.authorization,
      "X-Forwarded-For": headers["x-forwarded-for"],
    },
    logger: logger({ ...ctx }),
  };
}
