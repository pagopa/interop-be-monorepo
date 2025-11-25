import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  ZodiosContext,
  ExpressContext,
  zodiosValidationErrorToApiProblem,
  validateAuthorization,
  authRole,
} from "pagopa-interop-commons";
import { emptyErrorMapper } from "pagopa-interop-models";
import { makeApiProblem } from "../model/errors.js";
import { fromM2MGatewayAppContext } from "../utils/context.js";
import { EventService } from "../services/eventService.js";

const { M2M_ROLE, M2M_ADMIN_ROLE } = authRole;

const eventRouter = (
  ctx: ZodiosContext,
  eventService: EventService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const eventRouter = ctx.router(m2mGatewayApi.eventsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  eventRouter.get("/eserviceEvents", async (req, res) => {
    const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
    try {
      validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

      const events = await eventService.getEServiceEvents(
        {
          lastEventId: req.query.lastEventId,
          limit: req.query.limit,
          delegationId: req.query.delegationId,
        },
        ctx
      );

      return res.status(200).send(m2mGatewayApi.EServiceEvents.parse(events));
    } catch (error) {
      const errorRes = makeApiProblem(
        error,
        emptyErrorMapper,
        ctx,
        "Error retrieving eservice events"
      );
      return res.status(errorRes.status).send();
    }
  });

  eventRouter.get("/attributeEvents", async (req, res) => {
    const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
    try {
      validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

      const events = await eventService.getAttributeEvents(
        {
          lastEventId: req.query.lastEventId,
          limit: req.query.limit,
        },
        ctx
      );

      return res.status(200).send(m2mGatewayApi.AttributeEvents.parse(events));
    } catch (error) {
      const errorRes = makeApiProblem(
        error,
        emptyErrorMapper,
        ctx,
        "Error retrieving attribute events"
      );
      return res.status(errorRes.status).send();
    }
  });

  eventRouter.get("/agreementEvents", async (req, res) => {
    const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
    try {
      validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

      const events = await eventService.getAgreementEvents(
        {
          lastEventId: req.query.lastEventId,
          limit: req.query.limit,
          delegationId: req.query.delegationId,
        },
        ctx
      );

      return res.status(200).send(m2mGatewayApi.AgreementEvents.parse(events));
    } catch (error) {
      const errorRes = makeApiProblem(
        error,
        emptyErrorMapper,
        ctx,
        "Error retrieving agreement events"
      );
      return res.status(errorRes.status).send();
    }
  });

  return eventRouter;
};

export default eventRouter;
