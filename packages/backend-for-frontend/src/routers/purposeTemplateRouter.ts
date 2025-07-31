import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { emptyErrorMapper, unsafeBrandId } from "pagopa-interop-models";
import { bffApi } from "pagopa-interop-api-clients";
import { PurposeTemplateService } from "../services/purposeTemplateService.js";
import { makeApiProblem } from "../model/errors.js";
import {
  getPurposesErrorMapper,
  getPurposeErrorMapper,
} from "../utilities/errorMappers.js";
import { fromBffAppContext } from "../utilities/context.js";

const purposeTemplateRouter = (
  ctx: ZodiosContext,
  purposeTemplateService: PurposeTemplateService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const purposeTemplateRouter = ctx.router(bffApi.purposeTemplatesApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  purposeTemplateRouter
    .get("/purposeTemplates", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await purposeTemplateService.getPurposeTemplates(
          {
            purposeTitle: req.query.purposeTitle,
            creatorIds: req.query.creatorIds,
            states: req.query.states,
            excludeDraft: req.query.excludeDraft,
          },
          req.query.offset,
          req.query.limit,
          ctx
        );

        return res.status(200).send(result);
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getPurposesErrorMapper,
          ctx,
          `Error retrieving Purpose Templates for purposeTitle ${req.query.purposeTitle}, creatorIds ${req.query.creatorIds}, states ${req.query.states}, excludeDraft ${req.query.excludeDraft}, offset ${req.query.offset}, limit ${req.query.limit}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposeTemplates", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await purposeTemplateService.createPurposeTemplate(
          req.body,
          ctx
        );

        return res.status(201).send(result);
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error creating Purpose Template with targetDescription ${req.body.targetDescription} and creatorId ${req.body.creatorId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/purposeTemplates/eservices", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await purposeTemplateService.getEservices(
          {
            eserviceIds: req.query.eserviceIds,
            purposeTemplateIds: req.query.purposeTemplateIds,
          },
          req.query.offset,
          req.query.limit,
          ctx
        );

        return res.status(200).send(result);
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving Eservices for eserviceIds ${req.query.eserviceIds}, purposeTemplateIds ${req.query.purposeTemplateIds}, offset ${req.query.offset}, limit ${req.query.limit}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/purposeTemplates/:id", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await purposeTemplateService.getPurposeTemplate(
          unsafeBrandId(req.params.id),
          ctx
        );

        return res.status(200).send(result);
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getPurposeErrorMapper,
          ctx,
          `Error retrieving purpose template ${req.params.id}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposeTemplates/:id", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await purposeTemplateService.updatePurposeTemplate(
          unsafeBrandId(req.params.id),
          req.body,
          ctx
        );

        return res.status(200).send(result);
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error updating Purpose Template ${req.params.id}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/purposeTemplates/:id", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        await purposeTemplateService.deletePurposeTemplate(
          unsafeBrandId(req.params.id),
          ctx
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error deleting purpose template ${req.params.id}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/purposeTemplates/:id/eservices", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await purposeTemplateService.getPurposeTemplateEservices(
          unsafeBrandId(req.params.id),
          ctx
        );

        return res.status(200).send(result);
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving eservices for purpose template ${req.params.id}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposeTemplates/:id/eservices", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result =
          await purposeTemplateService.addEserviceToPurposeTemplate(
            unsafeBrandId(req.params.id),
            req.body,
            ctx
          );

        return res.status(200).send(result);
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error adding eservice to purpose template ${req.params.id}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/purposeTemplates/:id/eservices", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        await purposeTemplateService.removeEserviceFromPurposeTemplate(
          unsafeBrandId(req.params.id),
          req.body,
          ctx
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error removing eservice from purpose template ${req.params.id}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposeTemplates/:id/suspend", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await purposeTemplateService.suspendPurposeTemplate(
          unsafeBrandId(req.params.id),
          ctx
        );

        return res.status(200).send(result);
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error suspending purpose template ${req.params.id}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposeTemplates/:id/unsuspend", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await purposeTemplateService.unsuspendPurposeTemplate(
          unsafeBrandId(req.params.id),
          ctx
        );

        return res.status(200).send(result);
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error unsuspending purpose template ${req.params.id}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposeTemplates/:id/archive", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await purposeTemplateService.archivePurposeTemplate(
          unsafeBrandId(req.params.id),
          ctx
        );

        return res.status(200).send(result);
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error archiving purpose template ${req.params.id}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposeTemplates/:id/activate", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await purposeTemplateService.activatePurposeTemplate(
          unsafeBrandId(req.params.id),
          ctx
        );

        return res.status(200).send(result);
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error activating purpose template ${req.params.id}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    });

  return purposeTemplateRouter;
};

export default purposeTemplateRouter;
