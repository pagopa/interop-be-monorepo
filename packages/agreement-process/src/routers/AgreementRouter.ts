import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  userRoles,
  authorizationMiddleware,
  initDB,
  ReadModelRepository,
  initFileManager,
  zodiosValidationErrorToApiProblem,
  fromAppContext,
} from "pagopa-interop-commons";
import {
  TenantId,
  DescriptorId,
  EServiceId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { api } from "../model/generated/api.js";
import {
  agreementDocumentToApiAgreementDocument,
  agreementToApiAgreement,
  apiAgreementStateToAgreementState,
  fromApiCompactTenant,
} from "../model/domain/apiConverter.js";
import { config } from "../utilities/config.js";
import { agreementServiceBuilder } from "../services/agreementService.js";
import { agreementQueryBuilder } from "../services/readmodel/agreementQuery.js";
import { tenantQueryBuilder } from "../services/readmodel/tenantQuery.js";
import { eserviceQueryBuilder } from "../services/readmodel/eserviceQuery.js";
import { attributeQueryBuilder } from "../services/readmodel/attributeQuery.js";
import { readModelServiceBuilder } from "../services/readmodel/readModelService.js";
import {
  cloneAgreementErrorMapper,
  addConsumerDocumentErrorMapper,
  activateAgreementErrorMapper,
  createAgreementErrorMapper,
  deleteAgreementErrorMapper,
  getConsumerDocumentErrorMapper,
  rejectAgreementErrorMapper,
  submitAgreementErrorMapper,
  suspendAgreementErrorMapper,
  updateAgreementErrorMapper,
  upgradeAgreementErrorMapper,
  removeConsumerDocumentErrorMapper,
  archiveAgreementErrorMapper,
  getAgreementErrorMapper,
  computeAgreementStateErrorMapper,
} from "../utilities/errorMappers.js";
import { makeApiProblem } from "../model/domain/errors.js";

const readModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);
const agreementQuery = agreementQueryBuilder(readModelService);
const tenantQuery = tenantQueryBuilder(readModelService);
const eserviceQuery = eserviceQueryBuilder(readModelService);
const attributeQuery = attributeQueryBuilder(readModelService);

const agreementService = agreementServiceBuilder(
  initDB({
    username: config.eventStoreDbUsername,
    password: config.eventStoreDbPassword,
    host: config.eventStoreDbHost,
    port: config.eventStoreDbPort,
    database: config.eventStoreDbName,
    schema: config.eventStoreDbSchema,
    useSSL: config.eventStoreDbUseSSL,
  }),
  agreementQuery,
  tenantQuery,
  eserviceQuery,
  attributeQuery,
  initFileManager(config)
);

const {
  ADMIN_ROLE,
  SECURITY_ROLE,
  API_ROLE,
  M2M_ROLE,
  INTERNAL_ROLE,
  SUPPORT_ROLE,
} = userRoles;

const agreementRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const agreementRouter = ctx.router(api.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  agreementRouter.post(
    "/agreements/:agreementId/submit",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const agreement = await agreementService.submitAgreement(
          unsafeBrandId(req.params.agreementId),
          req.body,
          ctx
        );
        return res.status(200).json(agreementToApiAgreement(agreement)).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          submitAgreementErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.post(
    "/agreements/:agreementId/activate",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const agreement = await agreementService.activateAgreement(
          unsafeBrandId(req.params.agreementId),
          ctx
        );

        return res.status(200).json(agreementToApiAgreement(agreement)).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          activateAgreementErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.post(
    "/agreements/:agreementId/consumer-documents",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const document = await agreementService.addConsumerDocument(
          unsafeBrandId(req.params.agreementId),
          req.body,
          ctx
        );

        return res
          .status(200)
          .json(agreementDocumentToApiAgreementDocument(document))
          .send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          addConsumerDocumentErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.get(
    "/agreements/:agreementId/consumer-documents/:documentId",
    authorizationMiddleware([ADMIN_ROLE, SUPPORT_ROLE]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const document = await agreementService.getAgreementConsumerDocument(
          unsafeBrandId(req.params.agreementId),
          unsafeBrandId(req.params.documentId),
          ctx
        );
        return res
          .status(200)
          .json(agreementDocumentToApiAgreementDocument(document))
          .send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getConsumerDocumentErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.delete(
    "/agreements/:agreementId/consumer-documents/:documentId",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        await agreementService.removeAgreementConsumerDocument(
          unsafeBrandId(req.params.agreementId),
          unsafeBrandId(req.params.documentId),
          ctx
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          removeConsumerDocumentErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.post(
    "/agreements/:agreementId/suspend",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const agreement = await agreementService.suspendAgreement(
          unsafeBrandId(req.params.agreementId),
          ctx
        );
        return res.status(200).json(agreementToApiAgreement(agreement)).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          suspendAgreementErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.post(
    "/agreements/:agreementId/reject",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const agreement = await agreementService.rejectAgreement(
          unsafeBrandId(req.params.agreementId),
          req.body.reason,
          ctx
        );
        return res.status(200).json(agreementToApiAgreement(agreement)).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          rejectAgreementErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.post(
    "/agreements/:agreementId/archive",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const agreement = await agreementService.archiveAgreement(
          unsafeBrandId(req.params.agreementId),
          ctx
        );
        return res.status(200).send(agreementToApiAgreement(agreement));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          archiveAgreementErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.post(
    "/agreements",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const agreement = await agreementService.createAgreement(req.body, ctx);
        return res.status(200).json(agreementToApiAgreement(agreement)).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          createAgreementErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.get(
    "/agreements",
    authorizationMiddleware([
      ADMIN_ROLE,
      API_ROLE,
      SECURITY_ROLE,
      M2M_ROLE,
      SUPPORT_ROLE,
    ]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const agreements = await agreementService.getAgreements(
          {
            eserviceId: req.query.eservicesIds.map(unsafeBrandId<EServiceId>),
            consumerId: req.query.consumersIds.map(unsafeBrandId<TenantId>),
            producerId: req.query.producersIds.map(unsafeBrandId<TenantId>),
            descriptorId: req.query.descriptorsIds.map(
              unsafeBrandId<DescriptorId>
            ),
            agreementStates: req.query.states.map(
              apiAgreementStateToAgreementState
            ),
            showOnlyUpgradeable: req.query.showOnlyUpgradeable || false,
          },
          req.query.limit,
          req.query.offset,
          ctx.logger
        );

        return res
          .status(200)
          .json({
            results: agreements.results.map(agreementToApiAgreement),
            totalCount: agreements.totalCount,
          })
          .end();
      } catch (error) {
        const errorRes = makeApiProblem(error, () => 500, ctx.logger);
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.get(
    "/producers",
    authorizationMiddleware([
      ADMIN_ROLE,
      API_ROLE,
      SECURITY_ROLE,
      SUPPORT_ROLE,
    ]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const producers = await agreementService.getAgreementProducers(
          req.query.producerName,
          req.query.limit,
          req.query.offset,
          ctx.logger
        );

        return res
          .status(200)
          .json({
            results: producers.results,
            totalCount: producers.totalCount,
          })
          .end();
      } catch (error) {
        const errorRes = makeApiProblem(error, () => 500, ctx.logger);
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.get(
    "/consumers",
    authorizationMiddleware([
      ADMIN_ROLE,
      API_ROLE,
      SECURITY_ROLE,
      SUPPORT_ROLE,
    ]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const consumers = await agreementService.getAgreementConsumers(
          req.query.consumerName,
          req.query.limit,
          req.query.offset,
          ctx.logger
        );

        return res
          .status(200)
          .json({
            results: consumers.results,
            totalCount: consumers.totalCount,
          })
          .end();
      } catch (error) {
        const errorRes = makeApiProblem(error, () => 500, ctx.logger);
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.get(
    "/agreements/:agreementId",
    authorizationMiddleware([
      ADMIN_ROLE,
      API_ROLE,
      SECURITY_ROLE,
      M2M_ROLE,
      INTERNAL_ROLE,
      SUPPORT_ROLE,
    ]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const agreement = await agreementService.getAgreementById(
          unsafeBrandId(req.params.agreementId),
          ctx.logger
        );
        return res.status(200).json(agreementToApiAgreement(agreement)).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getAgreementErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.delete(
    "/agreements/:agreementId",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        await agreementService.deleteAgreementById(
          unsafeBrandId(req.params.agreementId),
          ctx
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          deleteAgreementErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.post(
    "/agreements/:agreementId/update",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        await agreementService.updateAgreement(
          unsafeBrandId(req.params.agreementId),
          req.body,
          ctx
        );

        return res.status(200).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          updateAgreementErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.post(
    "/agreements/:agreementId/upgrade",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const agreement = await agreementService.upgradeAgreement(
          unsafeBrandId(req.params.agreementId),
          ctx
        );

        return res.status(200).json(agreementToApiAgreement(agreement)).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          upgradeAgreementErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.post(
    "/agreements/:agreementId/clone",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const agreement = await agreementService.cloneAgreement(
          unsafeBrandId(req.params.agreementId),
          ctx
        );

        return res.status(200).json(agreementToApiAgreement(agreement)).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          cloneAgreementErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.post(
    "/compute/agreementsState",
    authorizationMiddleware([ADMIN_ROLE, INTERNAL_ROLE, M2M_ROLE]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        await agreementService.computeAgreementsStateByAttribute(
          unsafeBrandId(req.body.attributeId),
          fromApiCompactTenant(req.body.consumer),
          ctx
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          computeAgreementStateErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.get(
    "/agreements/filter/eservices",
    authorizationMiddleware([
      ADMIN_ROLE,
      API_ROLE,
      SECURITY_ROLE,
      SUPPORT_ROLE,
    ]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const eservices = await agreementService.getAgreementEServices(
          {
            eserviceName: req.query.eServiceName,
            consumerIds: req.query.consumersIds.map(unsafeBrandId<TenantId>),
            producerIds: req.query.producersIds.map(unsafeBrandId<TenantId>),
            agreeementStates: req.query.states.map(
              apiAgreementStateToAgreementState
            ),
          },
          req.query.limit,
          req.query.offset,
          ctx.logger
        );

        return res
          .status(200)
          .json({
            results: eservices.results,
            totalCount: eservices.totalCount,
          })
          .end();
      } catch (error) {
        const errorRes = makeApiProblem(error, () => 500, ctx.logger);
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  return agreementRouter;
};
export default agreementRouter;
