import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { bffApi } from "pagopa-interop-api-clients";
import {
  ZodiosContext,
  ExpressContext,
  zodiosValidationErrorToApiProblem,
  FileManager,
} from "pagopa-interop-commons";
import { makeApiProblem } from "../model/errors.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { fromBffAppContext } from "../utilities/context.js";
import {
  activateAgreementErrorMapper,
  emptyErrorMapper,
  getAgreementByIdErrorMapper,
  getAgreementConsumerDocumentErrorMapper,
  getAgreementContractErrorMapper,
  getAgreementsErrorMapper,
} from "../utilities/errorMappers.js";
import { agreementServiceBuilder } from "../services/agreementService.js";

const agreementRouter = (
  ctx: ZodiosContext,
  clients: PagoPAInteropBeClients,
  fileManager: FileManager
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const agreementRouter = ctx.router(bffApi.agreementsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const agreementService = agreementServiceBuilder(clients, fileManager);

  agreementRouter
    .get("/agreements", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const {
          consumersIds,
          eservicesIds,
          limit,
          offset,
          producersIds,
          showOnlyUpgradeable,
          states,
        } = req.query;

        const result = await agreementService.getAgreements(
          {
            offset,
            limit,
            producersIds,
            eservicesIds,
            consumersIds,
            states,
            showOnlyUpgradeable,
          },
          ctx
        );
        return res.status(200).send(bffApi.Agreements.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getAgreementsErrorMapper,
          ctx.logger,
          "Error retrieving agreements"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .post("/agreements", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await agreementService.createAgreement(req.body, ctx);
        return res.status(200).send(bffApi.Agreement.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error creating agreement for EService ${req.body.eserviceId} and Descriptor ${req.body.descriptorId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .get("/producers/agreements/eservices", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      const { offset, limit, states, q } = req.query;
      try {
        const requesterId = ctx.authData.organizationId;
        const result = await agreementService.getAgreementsEserviceProducers(
          {
            offset,
            limit,
            states,
            requesterId,
            eServiceName: q,
          },
          ctx
        );

        return res.status(200).send(bffApi.CompactEServicesLight.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error retrieving eservices from agreement filtered by eservice name ${q}, offset ${offset}, limit ${limit}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .get("/consumers/agreements/eservices", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      const { offset, limit, q } = req.query;
      try {
        const requesterId = ctx.authData.organizationId;
        const result = await agreementService.getAgreementsEserviceConsumers(
          {
            offset,
            limit,
            requesterId,
            eServiceName: q,
          },
          ctx
        );

        return res.status(200).send(bffApi.CompactEServicesLight.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error retrieving eservices from agreement filtered by eservice name ${q}, offset ${offset}, limit ${limit}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .get("/agreements/filter/producers", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      const { offset, limit, q } = req.query;
      try {
        const result = await agreementService.getAgreementProducers(
          {
            offset,
            limit,
            producerName: q,
          },
          ctx
        );
        return res.status(200).send(bffApi.CompactOrganizations.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error retrieving producers from agreement filtered by producer name ${q}, offset ${offset}, limit ${limit}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .get("/agreements/filter/consumers", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      const { offset, limit, q } = req.query;
      try {
        const result = await agreementService.getAgreementConsumers(
          {
            offset,
            limit,
            consumerName: q,
          },
          ctx
        );
        return res.status(200).send(bffApi.CompactOrganizations.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error retrieving consumers from agreement filtered by consumer name ${q}, offset ${offset}, limit ${limit}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .get("/agreements/:agreementId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await agreementService.getAgreementById(
          req.params.agreementId,
          ctx
        );
        return res.status(200).send(bffApi.Agreement.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getAgreementByIdErrorMapper,
          ctx.logger,
          `Error retrieving agreement ${req.params.agreementId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .delete("/agreements/:agreementId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        await agreementService.deleteAgreement(req.params.agreementId, ctx);
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error deleting agreement ${req.params.agreementId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .post("/agreements/:agreementId/consumer-documents", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await agreementService.addAgreementConsumerDocument(
          req.params.agreementId,
          req.body,
          ctx
        );

        return res.status(200).send(result);
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error adding consumer document to agreement ${req.params.agreementId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .post("/agreements/:agreementId/activate", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await agreementService.activateAgreement(
          req.params.agreementId,
          ctx
        );
        return res.status(200).send(bffApi.Agreement.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          activateAgreementErrorMapper,
          ctx.logger,
          `Error activating agreement ${req.params.agreementId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .post("/agreements/:agreementId/clone", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await agreementService.cloneAgreement(
          req.params.agreementId,
          ctx
        );
        return res.status(200).send(bffApi.CompactAgreement.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error cloning agreement ${req.params.agreementId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .get(
      "/agreements/:agreementId/consumer-documents/:documentId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);

        try {
          const result = await agreementService.getAgreementConsumerDocument(
            req.params.agreementId,
            req.params.documentId,
            ctx
          );

          return res.status(200).send(result);
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getAgreementConsumerDocumentErrorMapper,
            ctx.logger,
            `Error downloading consumer document ${req.params.documentId} for agreement ${req.params.agreementId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )

    .delete(
      "/agreements/:agreementId/consumer-documents/:documentId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);

        try {
          await agreementService.removeConsumerDocument(
            req.params.agreementId,
            req.params.documentId,
            ctx
          );

          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx.logger,
            `Error deleting consumer document ${req.params.documentId} for agreement ${req.params.agreementId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )

    .get("/agreements/:agreementId/contract", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await agreementService.getAgreementContract(
          req.params.agreementId,
          ctx
        );

        return res.status(200).send(result);
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getAgreementContractErrorMapper,
          ctx.logger,
          `Error downloading contract for agreement ${req.params.agreementId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .post("/agreements/:agreementId/submit", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await agreementService.submitAgreement(
          req.params.agreementId,
          req.body,
          ctx
        );
        return res.status(200).send(bffApi.Agreement.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error submitting agreement ${req.params.agreementId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .post("/agreements/:agreementId/suspend", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await agreementService.suspendAgreement(
          req.params.agreementId,
          ctx
        );
        return res.status(200).send(bffApi.Agreement.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error suspending agreement ${req.params.agreementId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .post("/agreements/:agreementId/reject", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await agreementService.rejectAgreement(
          req.params.agreementId,
          req.body,
          ctx
        );
        return res.status(200).send(bffApi.Agreement.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error rejecting agreement ${req.params.agreementId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .post("/agreements/:agreementId/archive", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        await agreementService.archiveAgreement(req.params.agreementId, ctx);
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error archiving agreement ${req.params.agreementId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .post("/agreements/:agreementId/update", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await agreementService.updateAgreement(
          req.params.agreementId,
          req.body,
          ctx
        );
        return res.status(200).send(bffApi.Agreement.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error updating agreement ${req.params.agreementId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .post("/agreements/:agreementId/upgrade", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await agreementService.upgradeAgreement(
          req.params.agreementId,
          ctx
        );
        return res.status(200).send(bffApi.Agreement.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error upgrading agreement ${req.params.agreementId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    });

  return agreementRouter;
};

export default agreementRouter;
