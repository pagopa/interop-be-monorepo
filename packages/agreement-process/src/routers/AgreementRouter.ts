import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  userRoles,
  authorizationMiddleware,
  initDB,
  ReadModelRepository,
} from "pagopa-interop-commons";
import {
  Agreement,
  AgreementDocumentId,
  AgreementId,
} from "pagopa-interop-models";
import { api } from "../model/generated/api.js";
import {
  agreementDocumentToApiAgreementDocument,
  agreementToApiAgreement,
  apiAgreementStateToAgreementState,
} from "../model/domain/apiConverter.js";
import { config } from "../utilities/config.js";
import { agreementServiceBuilder } from "../services/agreementService.js";
import { agreementQueryBuilder } from "../services/readmodel/agreementQuery.js";
import { tenantQueryBuilder } from "../services/readmodel/tenantQuery.js";
import { eserviceQueryBuilder } from "../services/readmodel/eserviceQuery.js";
import { attributeQueryBuilder } from "../services/readmodel/attributeQuery.js";
import { readModelServiceBuilder } from "../services/readmodel/readModelService.js";
import { agreementNotFound, makeApiProblem } from "../model/domain/errors.js";
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
} from "../utilities/errorMappers.js";

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
  attributeQuery
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
  const agreementRouter = ctx.router(api.api);

  agreementRouter.post(
    "/agreements/:agreementId/submit",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      try {
        const id = await agreementService.submitAgreement(
          req.params.agreementId as AgreementId,
          req.body
        );
        return res.status(200).json({ id }).end();
      } catch (error) {
        const errorRes = makeApiProblem(error, submitAgreementErrorMapper);
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.post(
    "/agreements/:agreementId/activate",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      try {
        const agreementId: Agreement["id"] =
          await agreementService.activateAgreement(
            req.params.agreementId,
            req.ctx.authData
          );

        return res.status(200).json({ id: agreementId }).end();
      } catch (error) {
        const errorRes = makeApiProblem(error, activateAgreementErrorMapper);
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.post(
    "/agreements/:agreementId/consumer-documents",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      try {
        const id = await agreementService.addConsumerDocument(
          req.params.agreementId as AgreementId,
          req.body,
          req.ctx.authData
        );

        return res.status(200).json({ id }).send();
      } catch (error) {
        const errorRes = makeApiProblem(error, addConsumerDocumentErrorMapper);
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.get(
    "/agreements/:agreementId/consumer-documents/:documentId",
    authorizationMiddleware([ADMIN_ROLE, SUPPORT_ROLE]),
    async (req, res) => {
      try {
        const document = await agreementService.getAgreementConsumerDocument(
          req.params.agreementId as AgreementId,
          req.params.documentId as AgreementDocumentId,
          req.ctx.authData
        );
        return res
          .status(200)
          .json(agreementDocumentToApiAgreementDocument(document))
          .send();
      } catch (error) {
        const errorRes = makeApiProblem(error, getConsumerDocumentErrorMapper);
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.delete(
    "/agreements/:agreementId/consumer-documents/:documentId",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      try {
        await agreementService.removeAgreementConsumerDocument(
          req.params.agreementId as AgreementId,
          req.params.documentId as AgreementDocumentId,
          req.ctx.authData
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          removeConsumerDocumentErrorMapper
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.post(
    "/agreements/:agreementId/suspend",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      try {
        const id = await agreementService.suspendAgreement(
          req.params.agreementId as AgreementId,
          req.ctx.authData
        );
        return res.status(200).json({ id }).send();
      } catch (error) {
        const errorRes = makeApiProblem(error, suspendAgreementErrorMapper);
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.post(
    "/agreements/:agreementId/reject",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      try {
        const id = await agreementService.rejectAgreement(
          req.params.agreementId as AgreementId,
          req.body.reason,
          req.ctx.authData
        );
        return res.status(200).json({ id }).send();
      } catch (error) {
        const errorRes = makeApiProblem(error, rejectAgreementErrorMapper);
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.post(
    "/agreements/:agreementId/archive",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      try {
        const agreementId = await agreementService.archiveAgreement(
          req.params.agreementId,
          req.ctx.authData
        );
        return res.status(200).send({ id: agreementId });
      } catch (error) {
        const errorRes = makeApiProblem(error, archiveAgreementErrorMapper);
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.post(
    "/agreements",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      try {
        const id = await agreementService.createAgreement(
          req.body,
          req.ctx.authData
        );
        return res.status(200).json({ id }).send();
      } catch (error) {
        const errorRes = makeApiProblem(error, createAgreementErrorMapper);
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
      try {
        const agreements = await agreementService.getAgreements(
          {
            eserviceId: req.query.eservicesIds,
            consumerId: req.query.consumersIds,
            producerId: req.query.producersIds,
            descriptorId: req.query.descriptorsIds,
            agreementStates: req.query.states.map(
              apiAgreementStateToAgreementState
            ),
            showOnlyUpgradeable: req.query.showOnlyUpgradeable || false,
          },
          req.query.limit,
          req.query.offset
        );

        return res
          .status(200)
          .json({
            results: agreements.results.map(agreementToApiAgreement),
            totalCount: agreements.totalCount,
          })
          .end();
      } catch (error) {
        const errorRes = makeApiProblem(error, () => 500);
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
      try {
        const producers = await agreementService.getAgreementProducers(
          req.query.producerName,
          req.query.limit,
          req.query.offset
        );

        return res
          .status(200)
          .json({
            results: producers.results,
            totalCount: producers.totalCount,
          })
          .end();
      } catch (error) {
        const errorRes = makeApiProblem(error, () => 500);
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
      try {
        const consumers = await agreementService.getAgreementConsumers(
          req.query.consumerName,
          req.query.limit,
          req.query.offset
        );

        return res
          .status(200)
          .json({
            results: consumers.results,
            totalCount: consumers.totalCount,
          })
          .end();
      } catch (error) {
        const errorRes = makeApiProblem(error, () => 500);
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
      try {
        const agreement = await agreementService.getAgreementById(
          req.params.agreementId as AgreementId
        );
        if (agreement) {
          return res
            .status(200)
            .json(agreementToApiAgreement(agreement))
            .send();
        } else {
          return res
            .status(404)
            .json(
              makeApiProblem(
                agreementNotFound(req.params.agreementId),
                () => 404
              )
            )
            .send();
        }
      } catch (error) {
        const errorRes = makeApiProblem(error, () => 500);
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.delete(
    "/agreements/:agreementId",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      try {
        await agreementService.deleteAgreementById(
          req.params.agreementId as AgreementId,
          req.ctx.authData
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(error, deleteAgreementErrorMapper);
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.post(
    "/agreements/:agreementId/update",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      try {
        await agreementService.updateAgreement(
          req.params.agreementId as AgreementId,
          req.body,
          req.ctx.authData
        );

        return res.status(200).send();
      } catch (error) {
        const errorRes = makeApiProblem(error, updateAgreementErrorMapper);
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.post(
    "/agreements/:agreementId/upgrade",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      try {
        const id = await agreementService.upgradeAgreement(
          req.params.agreementId as AgreementId,
          req.ctx.authData
        );

        return res.status(200).json({ id }).send();
      } catch (error) {
        const errorRes = makeApiProblem(error, upgradeAgreementErrorMapper);
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.post(
    "/agreements/:agreementId/clone",
    authorizationMiddleware([ADMIN_ROLE]),
    async (req, res) => {
      try {
        const id = await agreementService.cloneAgreement(
          req.params.agreementId as AgreementId,
          req.ctx.authData
        );

        return res.status(200).json({ id }).send();
      } catch (error) {
        const errorRes = makeApiProblem(error, cloneAgreementErrorMapper);
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  agreementRouter.post("/compute/agreementsState", async (_req, res) => {
    res.status(501).send();
  });

  agreementRouter.get(
    "/agreements/filter/eservices",
    authorizationMiddleware([
      ADMIN_ROLE,
      API_ROLE,
      SECURITY_ROLE,
      SUPPORT_ROLE,
    ]),
    async (req, res) => {
      try {
        const eservices = await agreementService.getAgreementEServices(
          req.query.eServiceName,
          req.query.consumersIds,
          req.query.producersIds,
          req.query.limit,
          req.query.offset
        );

        return res
          .status(200)
          .json({
            results: eservices.results,
            totalCount: eservices.totalCount,
          })
          .end();
      } catch (error) {
        const errorRes = makeApiProblem(error, () => 500);
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );

  return agreementRouter;
};
export default agreementRouter;
