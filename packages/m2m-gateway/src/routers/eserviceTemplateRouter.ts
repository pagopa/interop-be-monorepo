import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  ZodiosContext,
  ExpressContext,
  zodiosValidationErrorToApiProblem,
  fromAppContext,
} from "pagopa-interop-commons";
import { emptyErrorMapper } from "pagopa-interop-models";
import { makeApiProblem } from "../model/errors.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { eserviceTemplateServiceBuilder } from "../services/eserviceTemplateService.js";

const eserviceTemplateRouter = (
  ctx: ZodiosContext,
  clients: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const eserviceTemplateRouter = ctx.router(
    m2mGatewayApi.eserviceTemplatesApi.api,
    {
      validationErrorHandler: zodiosValidationErrorToApiProblem,
    }
  );

  const eserviceTemplateService = eserviceTemplateServiceBuilder(clients);
  void eserviceTemplateService;

  eserviceTemplateRouter
    .get("/eserviceTemplates/:templateId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving eservice template with id ${req.params.templateId}`
        );
        return res.status(errorRes.status).send();
      }
    })
    .get("/eserviceTemplates/:templateId/versions", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving eservice template ${req.params.templateId} versions`
        );
        return res.status(errorRes.status).send();
      }
    })
    .get(
      "/eserviceTemplates/:templateId/versions/:versionId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          return res.status(501).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error retrieving eservice template ${req.params.templateId} version ${req.params.versionId}`
          );
          return res.status(errorRes.status).send();
        }
      }
    )
    .post("/eserviceTemplates/:templateId/versions", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error creating eserviceTemplate ${req.params.templateId} version`
        );
        return res.status(errorRes.status).send();
      }
    })
    .patch(
      "/eserviceTemplates/:templateId/versions/:versionId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          return res.status(501).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error updating draft eservice template ${req.params.templateId} version ${req.params.versionId}`
          );
          return res.status(errorRes.status).send();
        }
      }
    );

  return eserviceTemplateRouter;
};

export default eserviceTemplateRouter;
