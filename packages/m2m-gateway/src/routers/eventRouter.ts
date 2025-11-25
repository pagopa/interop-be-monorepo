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

  eventRouter.get("/eserviceTemplateEvents", async (req, res) => {
    const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
    try {
      validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

      const events = await eventService.getEServiceTemplateEvents(
        {
          lastEventId: req.query.lastEventId,
          limit: req.query.limit,
        },
        ctx
      );

      return res
        .status(200)
        .send(m2mGatewayApi.EServiceTemplateEvents.parse(events));
    } catch (error) {
      const errorRes = makeApiProblem(
        error,
        emptyErrorMapper,
        ctx,
        "Error retrieving eservice template events"
      );
      return res.status(errorRes.status).send();
    }
  });

  eventRouter.get("/keyEvents", async (req, res) => {
    const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
    try {
      validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

      const events = await eventService.getKeyEvents(
        {
          lastEventId: req.query.lastEventId,
          limit: req.query.limit,
        },
        ctx
      );

      return res.status(200).send(m2mGatewayApi.KeyEvents.parse(events));
    } catch (error) {
      const errorRes = makeApiProblem(
        error,
        emptyErrorMapper,
        ctx,
        "Error retrieving key events"
      );
      return res.status(errorRes.status).send();
    }
  });

  eventRouter.get("/clientEvents", async (req, res) => {
    const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
    try {
      validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

      const events = await eventService.getClientsEvents(
        {
          lastEventId: req.query.lastEventId,
          limit: req.query.limit,
        },
        ctx
      );

      return res.status(200).send(m2mGatewayApi.ClientEvents.parse(events));
    } catch (error) {
      const errorRes = makeApiProblem(
        error,
        emptyErrorMapper,
        ctx,
        "Error retrieving client events"
      );
      return res.status(errorRes.status).send();
    }
  });

  eventRouter.get("/producerKeyEvents", async (req, res) => {
    const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
    try {
      validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

      const events = await eventService.getProducerKeysEvents(
        {
          lastEventId: req.query.lastEventId,
          limit: req.query.limit,
        },
        ctx
      );

      return res
        .status(200)
        .send(m2mGatewayApi.ProducerKeyEvents.parse(events));
    } catch (error) {
      const errorRes = makeApiProblem(
        error,
        emptyErrorMapper,
        ctx,
        "Error retrieving producer key events"
      );
      return res.status(errorRes.status).send();
    }
  });

  eventRouter.get("/producerKeychainEvents", async (req, res) => {
    const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
    try {
      validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

      const events = await eventService.getProducerKeychainsEvents(
        {
          lastEventId: req.query.lastEventId,
          limit: req.query.limit,
        },
        ctx
      );

      return res
        .status(200)
        .send(m2mGatewayApi.ProducerKeychainEvents.parse(events));
    } catch (error) {
      const errorRes = makeApiProblem(
        error,
        emptyErrorMapper,
        ctx,
        "Error retrieving producer keychain events"
      );
      return res.status(errorRes.status).send();
    }
  });

  return eventRouter;
};

export default eventRouter;
