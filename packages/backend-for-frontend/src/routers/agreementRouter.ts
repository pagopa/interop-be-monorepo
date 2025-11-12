import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { bffApi } from "pagopa-interop-api-clients";
import {
  ZodiosContext,
  ExpressContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { emptyErrorMapper } from "pagopa-interop-models";
import { makeApiProblem } from "../model/errors.js";
import { fromBffAppContext } from "../utilities/context.js";
import {
  activateAgreementErrorMapper,
  getAgreementByIdErrorMapper,
  getAgreementContractErrorMapper,
  getAgreementSignedContractErrorMapper,
  getAgreementsErrorMapper,
} from "../utilities/errorMappers.js";
import { AgreementService } from "../services/agreementService.js";

const agreementRouter = (
  ctx: ZodiosContext,
  agreementService: AgreementService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const agreementRouter = ctx.router(bffApi.agreementsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  agreementRouter
    .get("/consumers/agreements", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const {
          producersIds,
          eservicesIds,
          limit,
          offset,
          showOnlyUpgradeable,
          states,
        } = req.query;

        const result = await agreementService.getConsumerAgreements(
          {
            offset,
            limit,
            eservicesIds,
            producersIds,
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
          ctx,
          "Error retrieving agreements"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .get("/producers/agreements", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const {
          consumersIds,
          eservicesIds,
          limit,
          offset,
          showOnlyUpgradeable,
          states,
        } = req.query;

        const result = await agreementService.getProducerAgreements(
          {
            offset,
            limit,
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
          ctx,
          "Error retrieving agreements"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .post("/agreements", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await agreementService.createAgreement(req.body, ctx);
        return res.status(200).send(bffApi.CreatedResource.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error creating agreement for EService ${req.body.eserviceId} and Descriptor ${req.body.descriptorId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .get("/producers/agreements/eservices", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      const { offset, limit, q } = req.query;
      try {
        const requesterId = ctx.authData.organizationId;
        const result = await agreementService.getAgreementsProducerEServices(
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
          ctx,
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
        const result = await agreementService.getAgreementsConsumerEServices(
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
          ctx,
          `Error retrieving eservices from agreement filtered by eservice name ${q}, offset ${offset}, limit ${limit}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .get("/agreements/filter/producers", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      const { offset, limit, q } = req.query;
      try {
        const result = await agreementService.getAgreementsProducers(
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
          ctx,
          `Error retrieving producers from agreement filtered by producer name ${q}, offset ${offset}, limit ${limit}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .get("/agreements/filter/consumers", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      const { offset, limit, q } = req.query;
      try {
        const result = await agreementService.getAgreementsConsumers(
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
          ctx,
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
          ctx,
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
          ctx,
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
          ctx,
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
          req.body.delegationId,
          ctx
        );
        return res.status(200).send(bffApi.Agreement.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          activateAgreementErrorMapper,
          ctx,
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
        return res.status(200).send(bffApi.CreatedResource.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
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
            emptyErrorMapper,
            ctx,
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
            ctx,
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
          ctx,
          `Error downloading contract for agreement ${req.params.agreementId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/agreements/:agreementId/signedContract", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await agreementService.getAgreementSignedContract(
          req.params.agreementId,
          ctx
        );

        return res.status(200).send(result);
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getAgreementSignedContractErrorMapper,
          ctx,
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
          ctx,
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
          req.body.delegationId,
          ctx
        );
        return res.status(200).send(bffApi.Agreement.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
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
          ctx,
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
          ctx,
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
          ctx,
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
          ctx,
          `Error upgrading agreement ${req.params.agreementId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .get(
      "/tenants/:tenantId/eservices/:eserviceId/descriptors/:descriptorId/certifiedAttributes/validate",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);

        try {
          const result = await agreementService.verifyTenantCertifiedAttributes(
            req.params.tenantId,
            req.params.eserviceId,
            req.params.descriptorId,
            ctx
          );
          return res
            .status(200)
            .send(bffApi.HasCertifiedAttributes.parse(result));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error verifying certified attributes`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  return agreementRouter;
};

export default agreementRouter;
