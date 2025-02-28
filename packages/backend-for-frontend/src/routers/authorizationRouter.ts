import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { bffApi } from "pagopa-interop-api-clients";
import {
  ExpressContext,
  InteropTokenGenerator,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
  RateLimiter,
  rateLimiterHeadersFromStatus,
} from "pagopa-interop-commons";
import { tooManyRequestsError } from "pagopa-interop-models";
import {
  ApplicationAuditBeginRequest,
  ApplicationAuditEndRequestCustomBFF,
  Phase,
} from "pagopa-interop-application-audit";
import { initProducer } from "kafka-iam-auth";
import { makeApiProblem } from "../model/errors.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { authorizationServiceBuilder } from "../services/authorizationService.js";
import { sessionTokenErrorMapper } from "../utilities/errorMappers.js";
import { config } from "../config/config.js";
import { fromBffAppContext } from "../utilities/context.js";
import { serviceName } from "../app.js";

const producer = await initProducer(config, config.applicationAuditTopic);

const authorizationRouter = (
  ctx: ZodiosContext,
  { tenantProcessClient }: PagoPAInteropBeClients,
  allowList: string[],
  rateLimiter: RateLimiter
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const authorizationRouter = ctx.router(bffApi.authorizationApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const interopTokenGenerator = new InteropTokenGenerator(config);
  const authorizationService = authorizationServiceBuilder(
    interopTokenGenerator,
    tenantProcessClient,
    allowList,
    rateLimiter
  );

  authorizationRouter
    .post("/session/tokens", async (req, res) => {
      const { identity_token: identityToken } = req.body;
      const ctx = fromBffAppContext(req.ctx, req.headers);

      const requestTimestamp = Date.now();

      const firstMessage: ApplicationAuditBeginRequest = {
        correlationId: ctx.correlationId,
        service: serviceName,
        serviceVersion: config.serviceVersion,
        endpoint: req.path,
        httpMethod: req.method,
        phase: Phase.BEGIN_REQUEST,
        requesterIpAddress: "TODO",
        nodeIp: config.nodeIp,
        podName: config.podName,
        uptimeSeconds: process.uptime(), // TODO how many decimal digits?
        timestamp: requestTimestamp,
        amazonTraceId: config.amazonTraceId,
      };

      await producer.send({
        messages: [
          {
            key: "TODO",
            value: JSON.stringify(firstMessage),
          },
        ],
      });

      try {
        const result = await authorizationService.getSessionToken(
          identityToken,
          ctx
        );

        const headers = rateLimiterHeadersFromStatus(result.rateLimiterStatus);
        res.set(headers);

        if (result.limitReached) {
          throw tooManyRequestsError(result.tenantId);
        }

        const endTimestamp = Date.now();
        const secondMessage: ApplicationAuditEndRequestCustomBFF = {
          correlationId: ctx.correlationId,
          service: serviceName,
          serviceVersion: config.serviceVersion,
          endpoint: req.path,
          httpMethod: req.method,
          phase: Phase.END_REQUEST,
          requesterIpAddress: "TODO",
          nodeIp: config.nodeIp,
          podName: config.podName,
          uptimeSeconds: process.uptime(),
          timestamp: endTimestamp,
          amazonTraceId: config.amazonTraceId,
          organizationId: result.sessionToken.session_token,
          selfcareId: result.selfcareId,
          httpResponseStatus: res.statusCode,
          executionTimeMs: endTimestamp - requestTimestamp,
        };

        await producer.send({
          messages: [
            {
              key: "TODO",
              value: JSON.stringify(secondMessage),
            },
          ],
        });

        return res
          .status(200)
          .send(bffApi.SessionToken.parse(result.sessionToken));
      } catch (error) {
        const err = makeApiProblem(
          error,
          sessionTokenErrorMapper,
          ctx.logger,
          ctx.correlationId,
          "Error creating a session token"
        );

        const endTimestamp = Date.now();

        const secondMessage: ApplicationAuditEndRequestCustomBFF = {
          correlationId: ctx.correlationId,
          service: serviceName,
          serviceVersion: config.serviceVersion,
          endpoint: req.path,
          httpMethod: req.method,
          phase: Phase.END_REQUEST,
          requesterIpAddress: "TODO",
          nodeIp: config.nodeIp,
          podName: config.podName,
          uptimeSeconds: process.uptime(),
          timestamp: endTimestamp,
          amazonTraceId: config.amazonTraceId,
          httpResponseStatus: err.status,
          executionTimeMs: endTimestamp - requestTimestamp,
        };

        await producer.send({
          messages: [
            {
              key: "TODO",
              value: JSON.stringify(secondMessage),
            },
          ],
        });

        return res.status(err.status).send();
      }
    })
    .post("/support", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const jwt = await authorizationService.samlLoginCallback(
          req.body.SAMLResponse,
          ctx
        );
        return res.redirect(
          302,
          `${config.samlCallbackUrl}#saml2=${req.body.SAMLResponse}&jwt=${jwt}`
        );
      } catch (error) {
        ctx.logger.error(`Error calling support SAML - ${error}`);
        return res.redirect(302, config.samlCallbackErrorUrl);
      }
    });

  return authorizationRouter;
};

export default authorizationRouter;
