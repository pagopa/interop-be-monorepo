import { constants } from "http2";
import { FastifyReply, FastifyRequest } from "fastify";
import { genericLogger, isFeatureFlagEnabled } from "pagopa-interop-commons";
import {
  featureFlagNotEnabled,
  makeApiProblemBuilder,
  unsafeBrandId,
} from "pagopa-interop-models";
import { config } from "../config/config.js";

const makeApiProblem = makeApiProblemBuilder({});

export async function notificationConfigFeatureFlagHook(
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!isFeatureFlagEnabled(config, "featureFlagNotificationConfig")) {
    const errorRes = makeApiProblem(
      featureFlagNotEnabled("featureFlagNotificationConfig"),
      () => constants.HTTP_STATUS_FORBIDDEN,
      {
        logger: genericLogger,
        correlationId: unsafeBrandId(""),
        serviceName: "",
      }
    );
    return reply.status(errorRes.status).send(errorRes);
  }
}
