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
import { emptyErrorMapper, unsafeBrandId } from "pagopa-interop-models";
import { makeApiProblem } from "../model/errors.js";
import { AgreementService } from "../services/agreementService.js";
import { fromM2MGatewayAppContext } from "../utils/context.js";
import {
  approveAgreementErrorMapper,
  downloadAgreementConsumerContractErrorMapper,
  unsuspendAgreementErrorMapper,
} from "../utils/errorMappers.js";
import { sendDownloadedDocumentAsFormData } from "../utils/fileDownload.js";

const agreementRouter = (
  ctx: ZodiosContext,
  agreementService: AgreementService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const { M2M_ROLE, M2M_ADMIN_ROLE } = authRole;
  const agreementRouter = ctx.router(m2mGatewayApiV3.agreementsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  agreementRouter
    .get("/agreements", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);
        const agreements = await agreementService.getAgreements(req.query, ctx);

        return res
          .status(200)
          .send(m2mGatewayApiV3.Agreements.parse(agreements));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error retrieving agreements"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/agreements/:agreementId", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);
        const agreement = await agreementService.getAgreement(
          unsafeBrandId(req.params.agreementId),
          ctx
        );

        return res.status(200).send(m2mGatewayApiV3.Agreement.parse(agreement));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error getting agreement by id ${req.params.agreementId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/agreements/:agreementId", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        await agreementService.deleteAgreementById(
          unsafeBrandId(req.params.agreementId),
          ctx
        );

        return res.status(200).send({});
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error deleting agreement with id ${req.params.agreementId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/agreements/:agreementId/purposes", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);
        const purposes = await agreementService.getAgreementPurposes(
          unsafeBrandId(req.params.agreementId),
          req.query,
          ctx
        );

        return res.status(200).send(m2mGatewayApiV3.Purposes.parse(purposes));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error getting purposes for agreement with id ${req.params.agreementId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/agreements", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);
        const agreement = await agreementService.createAgreement(req.body, ctx);

        return res.status(201).send(m2mGatewayApiV3.Agreement.parse(agreement));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error creating agreement`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/agreements/:agreementId/approve", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);
        const agreement = await agreementService.approveAgreement(
          unsafeBrandId(req.params.agreementId),
          req.body,
          ctx
        );

        return res.status(200).send(m2mGatewayApiV3.Agreement.parse(agreement));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          approveAgreementErrorMapper,
          ctx,
          `Error approving agreement with id ${req.params.agreementId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/agreements/:agreementId/reject", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);
        const agreement = await agreementService.rejectAgreement(
          unsafeBrandId(req.params.agreementId),
          req.body,
          ctx
        );

        return res.status(200).send(m2mGatewayApiV3.Agreement.parse(agreement));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error rejecting agreement with id ${req.params.agreementId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/agreements/:agreementId/submit", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);
        const agreement = await agreementService.submitAgreement(
          unsafeBrandId(req.params.agreementId),
          req.body,
          ctx
        );

        return res.status(200).send(m2mGatewayApiV3.Agreement.parse(agreement));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error submitting agreement with id ${req.params.agreementId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/agreements/:agreementId/suspend", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);
        const agreement = await agreementService.suspendAgreement(
          unsafeBrandId(req.params.agreementId),
          req.body,
          ctx
        );

        return res.status(200).send(m2mGatewayApiV3.Agreement.parse(agreement));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error suspending agreement with id ${req.params.agreementId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/agreements/:agreementId/unsuspend", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);
        const agreement = await agreementService.unsuspendAgreement(
          unsafeBrandId(req.params.agreementId),
          req.body,
          ctx
        );

        return res.status(200).send(m2mGatewayApiV3.Agreement.parse(agreement));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          unsuspendAgreementErrorMapper,
          ctx,
          `Error unsuspending agreement with id ${req.params.agreementId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/agreements/:agreementId/upgrade", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);
        const agreement = await agreementService.upgradeAgreement(
          unsafeBrandId(req.params.agreementId),
          ctx
        );

        return res.status(200).send(m2mGatewayApiV3.Agreement.parse(agreement));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error upgrading agreement with id ${req.params.agreementId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/agreements/:agreementId/consumerDocuments", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);
        const documents = await agreementService.getAgreementConsumerDocuments(
          unsafeBrandId(req.params.agreementId),
          req.query,
          ctx
        );

        return res.status(200).send(m2mGatewayApiV3.Documents.parse(documents));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving consumer documents for agreement with id ${req.params.agreementId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/agreements/:agreementId/consumerDocuments", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);
        const document = await agreementService.uploadAgreementConsumerDocument(
          unsafeBrandId(req.params.agreementId),
          req.body,
          ctx
        );

        return res.status(201).send(m2mGatewayApiV3.Document.parse(document));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error adding consumer document to agreement with id ${req.params.agreementId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get(
      "/agreements/:agreementId/consumerDocuments/:documentId",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
        try {
          validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);
          const file = await agreementService.downloadAgreementConsumerDocument(
            unsafeBrandId(req.params.agreementId),
            unsafeBrandId(req.params.documentId),
            ctx
          );

          return sendDownloadedDocumentAsFormData(
            file,
            res,
            ctx.authData.clientId
          );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error retrieving consumer document with id ${req.params.documentId} for agreement with id ${req.params.agreementId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get("/agreements/:agreementId/contract", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);
        const file = await agreementService.downloadAgreementConsumerContract(
          unsafeBrandId(req.params.agreementId),
          ctx
        );

        return sendDownloadedDocumentAsFormData(
          file,
          res,
          ctx.authData.clientId
        );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          downloadAgreementConsumerContractErrorMapper,
          ctx,
          `Error retrieving contract for agreement with id ${req.params.agreementId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete(
      "/agreements/:agreementId/consumerDocuments/:documentId",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

          await agreementService.deleteAgreementConsumerDocument(
            unsafeBrandId(req.params.agreementId),
            unsafeBrandId(req.params.documentId),
            ctx
          );

          return res.status(200).send({});
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error deleting consumer document ${req.params.documentId} of agreement ${req.params.agreementId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post("/agreements/:agreementId/clone", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const clonedAgreement = await agreementService.cloneAgreement(
          unsafeBrandId(req.params.agreementId),
          ctx
        );

        return res
          .status(200)
          .send(m2mGatewayApiV3.Agreement.parse(clonedAgreement));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error cloning agreement ${req.params.agreementId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    });

  return agreementRouter;
};

export default agreementRouter;
