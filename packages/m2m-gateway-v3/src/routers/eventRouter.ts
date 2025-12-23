import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
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
  const eventRouter = ctx.router(m2mGatewayApiV3.eventsApi.api, {
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

      return res.status(200).send(m2mGatewayApiV3.EServiceEvents.parse(events));
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

      return res
        .status(200)
        .send(m2mGatewayApiV3.AttributeEvents.parse(events));
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

  eventRouter.get("/purposeEvents", async (req, res) => {
    const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
    try {
      validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

      const events = await eventService.getPurposeEvents(
        {
          lastEventId: req.query.lastEventId,
          limit: req.query.limit,
          delegationId: req.query.delegationId,
        },
        ctx
      );

      return res.status(200).send(m2mGatewayApiV3.PurposeEvents.parse(events));
    } catch (error) {
      const errorRes = makeApiProblem(
        error,
        emptyErrorMapper,
        ctx,
        "Error retrieving purpose events"
      );
      return res.status(errorRes.status).send();
    }
  });
  eventRouter.get("/tenantEvents", async (req, res) => {
    const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
    try {
      validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

      const events = await eventService.getTenantEvents(
        {
          lastEventId: req.query.lastEventId,
          limit: req.query.limit,
        },
        ctx
      );
      return res.status(200).send(m2mGatewayApiV3.TenantEvents.parse(events));
    } catch (error) {
      const errorRes = makeApiProblem(
        error,
        emptyErrorMapper,
        ctx,
        "Error retrieving tenant events"
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
        .send(m2mGatewayApiV3.EServiceTemplateEvents.parse(events));
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

      return res
        .status(200)
        .send(m2mGatewayApiV3.AgreementEvents.parse(events));
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

      return res.status(200).send(m2mGatewayApiV3.KeyEvents.parse(events));
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

      const events = await eventService.getClientEvents(
        {
          lastEventId: req.query.lastEventId,
          limit: req.query.limit,
        },
        ctx
      );

      return res.status(200).send(m2mGatewayApiV3.ClientEvents.parse(events));
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

      const events = await eventService.getProducerKeyEvents(
        {
          lastEventId: req.query.lastEventId,
          limit: req.query.limit,
        },
        ctx
      );

      return res
        .status(200)
        .send(m2mGatewayApiV3.ProducerKeyEvents.parse(events));
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

      const events = await eventService.getProducerKeychainEvents(
        {
          lastEventId: req.query.lastEventId,
          limit: req.query.limit,
        },
        ctx
      );

      return res
        .status(200)
        .send(m2mGatewayApiV3.ProducerKeychainEvents.parse(events));
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

  eventRouter.get("/producerDelegationEvents", async (req, res) => {
    const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
    try {
      validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

      const events = await eventService.getProducerDelegationEvents(
        {
          lastEventId: req.query.lastEventId,
          limit: req.query.limit,
        },
        ctx
      );

      return res
        .status(200)
        .send(m2mGatewayApiV3.ProducerDelegationEvents.parse(events));
    } catch (error) {
      const errorRes = makeApiProblem(
        error,
        emptyErrorMapper,
        ctx,
        "Error retrieving producer delegation events"
      );
      return res.status(errorRes.status).send();
    }
  });

  eventRouter.get("/consumerDelegationEvents", async (req, res) => {
    const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
    try {
      validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

      const events = await eventService.getConsumerDelegationEvents(
        {
          lastEventId: req.query.lastEventId,
          limit: req.query.limit,
        },
        ctx
      );

      return res
        .status(200)
        .send(m2mGatewayApiV3.ConsumerDelegationEvents.parse(events));
    } catch (error) {
      const errorRes = makeApiProblem(
        error,
        emptyErrorMapper,
        ctx,
        "Error retrieving consumer delegation events"
      );
      return res.status(errorRes.status).send();
    }
  });

  return eventRouter;
};

export default eventRouter;
