import {
  authRole,
  ExpressContext,
  fromAppContext,
  validateAuthorization,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { ZodiosRouter } from "@zodios/express";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import { emptyErrorMapper } from "pagopa-interop-models";
import { m2mEventApi } from "pagopa-interop-api-clients";
import { M2MEventService } from "../services/m2mEventService.js";
import { makeApiProblem } from "../model/errors.js";

export const m2mEventRouter = (
  zodiosCtx: ZodiosContext,
  service: M2MEventService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const m2mEventRouter = zodiosCtx.router(m2mEventApi.m2mEventsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });
  const { M2M_ADMIN_ROLE, M2M_ROLE } = authRole;

  m2mEventRouter
    .get("/events/eservices", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE, M2M_ROLE]);
        const { lastEventId, limit } = req.query;
        const events = await service.getEServiceM2MEvents(
          lastEventId,
          limit,
          ctx
        );
        return res
          .status(200)
          .send(m2mEventApi.EServiceM2MEvents.parse(events));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error getting eservice events"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/events/agreements", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE, M2M_ROLE]);
        const { lastEventId, limit } = req.query;
        const events = await service.getAgreementM2MEvents(
          lastEventId,
          limit,
          ctx
        );
        return res
          .status(200)
          .send(m2mEventApi.AgreementM2MEvents.parse(events));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error getting agreement events"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/events/purposes", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE, M2M_ROLE]);
        const { lastEventId, limit } = req.query;
        const events = await service.getPurposeM2MEvents(
          lastEventId,
          limit,
          ctx
        );
        return res.status(200).send(m2mEventApi.PurposeM2MEvents.parse(events));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error getting purpose events"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/events/tenants", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE, M2M_ROLE]);
        const { lastEventId, limit } = req.query;
        const events = await service.getTenantM2MEvents(
          lastEventId,
          limit,
          ctx
        );
        return res.status(200).send(m2mEventApi.TenantM2MEvents.parse(events));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error getting tenant events"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/events/attributes", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE, M2M_ROLE]);
        const { lastEventId, limit } = req.query;
        const events = await service.getAttributeM2MEvents(
          lastEventId,
          limit,
          ctx
        );
        return res
          .status(200)
          .send(m2mEventApi.AttributeM2MEvents.parse(events));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error getting attribute events"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/events/consumerDelegations", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE, M2M_ROLE]);
        const { lastEventId, limit } = req.query;
        const events = await service.getConsumerDelegationM2MEvents(
          lastEventId,
          limit,
          ctx
        );
        return res
          .status(200)
          .send(m2mEventApi.ConsumerDelegationM2MEvents.parse(events));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error getting consumer delegation events"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/events/producerDelegations", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE, M2M_ROLE]);
        const { lastEventId, limit } = req.query;
        const events = await service.getProducerDelegationM2MEvents(
          lastEventId,
          limit,
          ctx
        );
        return res
          .status(200)
          .send(m2mEventApi.ProducerDelegationM2MEvents.parse(events));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error getting producer delegation events"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/events/clients", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE, M2M_ROLE]);
        const { lastEventId, limit } = req.query;
        const events = await service.getClientM2MEvents(
          lastEventId,
          limit,
          ctx
        );
        return res.status(200).send(m2mEventApi.ClientM2MEvents.parse(events));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error getting client events"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/events/producerKeychains", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE, M2M_ROLE]);
        const { lastEventId, limit } = req.query;
        const events = await service.getProducerKeychainM2MEvents(
          lastEventId,
          limit,
          ctx
        );
        return res
          .status(200)
          .send(m2mEventApi.ProducerKeychainM2MEvents.parse(events));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error getting producer keychain events"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/events/keys", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE, M2M_ROLE]);
        const { lastEventId, limit } = req.query;
        const events = await service.getKeyM2MEvents(lastEventId, limit, ctx);
        return res.status(200).send(m2mEventApi.KeyM2MEvents.parse(events));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error getting key events"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/events/producerKeys", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE, M2M_ROLE]);
        const { lastEventId, limit } = req.query;
        const events = await service.getProducerKeyM2MEvents(
          lastEventId,
          limit,
          ctx
        );
        return res
          .status(200)
          .send(m2mEventApi.ProducerKeyM2MEvents.parse(events));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error getting producer key events"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/events/eserviceTemplates", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE, M2M_ROLE]);
        const { lastEventId, limit } = req.query;
        const events = await service.getEServiceTemplateM2MEvents(
          lastEventId,
          limit,
          ctx
        );
        return res
          .status(200)
          .send(m2mEventApi.EServiceTemplateM2MEvents.parse(events));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error getting eservice template events"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    });

  return m2mEventRouter;
};
