/* eslint-disable sonarjs/no-identical-functions */
import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  authRole,
  ZodiosContext,
  ExpressContext,
  zodiosValidationErrorToApiProblem,
  validateAuthorization,
} from "pagopa-interop-commons";
import { emptyErrorMapper } from "pagopa-interop-models";
import { makeApiProblem } from "../model/errors.js";
import { fromM2MGatewayAppContext } from "../utils/context.js";
import { PurposeTemplateService } from "../services/purposeTemplateService.js";

const purposeTemplateRouter = (
  ctx: ZodiosContext,
  purposeTemplateService: PurposeTemplateService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const { M2M_ADMIN_ROLE, M2M_ROLE } = authRole;

  const purposeTemplateRouter = ctx.router(
    m2mGatewayApi.purposeTemplatesApi.api,
    {
      validationErrorHandler: zodiosValidationErrorToApiProblem,
    }
  );

  purposeTemplateRouter
    .get("/purposeTemplates", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const response = await purposeTemplateService.getPurposeTemplates(
          req.query,
          ctx
        );

        return res
          .status(200)
          .send(m2mGatewayApi.PurposeTemplates.parse(response));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving purpose templates`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposeTemplates", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error creating purpose template`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/purposeTemplates/:purposeTemplateId", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving purpose template with id ${req.params.purposeTemplateId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .put("/purposeTemplates/:purposeTemplateId", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error updating purpose template with id ${req.params.purposeTemplateId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/purposeTemplates/:purposeTemplateId", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error deleting purpose template ${req.params.purposeTemplateId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post(
      "/purposeTemplates/:purposeTemplateId/linkEservices",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          return res.status(501).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error updating purpose template ${req.params.purposeTemplateId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/purposeTemplates/:purposeTemplateId/linkEservices",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          return res.status(501).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error updating purpose template ${req.params.purposeTemplateId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get("/purposeTemplates/:purposeTemplateId/eservices", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving purpose template ${req.params.purposeTemplateId} versions`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposeTemplates/:purposeTemplateId/suspend", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error deleting purpose template ${req.params.purposeTemplateId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post(
      "/purposeTemplates/:purposeTemplateId/unsuspend",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
        try {
          return res.status(501).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error updating purpose template ${req.params.purposeTemplateId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post("/purposeTemplates/:purposeTemplateId/archive", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving purpose template ${req.params.purposeTemplateId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposeTemplates/:purposeTemplateId/publish", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error suspending purpose template ${req.params.purposeTemplateId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post(
      "/purposeTemplates/:purposeTemplateId/riskAnalysis/answers",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          return res.status(501).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error adding answer to purpose template ${req.params.purposeTemplateId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/purposeTemplates/:purposeTemplateId/riskAnalysis/answers/:answerId/annotation/documents",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          return res.status(501).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error adding document to purpose template ${req.params.purposeTemplateId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/purposeTemplates/:purposeTemplateId/riskAnalysis/answers/:answerId/annotation/documents/:documentId",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          return res.status(501).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error retrieving document with id ${req.params.documentId} for purpose template ${req.params.purposeTemplateId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/purposeTemplates/:purposeTemplateId/riskAnalysis/answers/:answerId/annotation/documents/:documentId",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          return res.status(501).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error deleting document with id ${req.params.documentId} for purpose template ${req.params.purposeTemplateId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .put(
      "/purposeTemplates/:purposeTemplateId/riskAnalysis/answers/:answerId/annotation",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          return res.status(501).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error updating annotation for purpose template ${req.params.purposeTemplateId} risk analysis answer with id ${req.params.answerId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/purposeTemplates/:purposeTemplateId/riskAnalysis/answers/:answerId/annotation",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          return res.status(501).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error deleting annotation for purpose template ${req.params.purposeTemplateId} risk analysis answer with id ${req.params.answerId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  return purposeTemplateRouter;
};

export default purposeTemplateRouter;
