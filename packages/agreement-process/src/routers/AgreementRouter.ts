import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ReadModelRepository,
  ZodiosContext,
  initDB,
  initFileManager,
  initPDFGenerator,
  zodiosValidationErrorToApiProblem,
  fromAppContext,
  authRole,
  validateAuthorization,
  setMetadataVersionHeader,
} from "pagopa-interop-commons";
import {
  TenantId,
  DescriptorId,
  EServiceId,
  unsafeBrandId,
  DelegationId,
  emptyErrorMapper,
} from "pagopa-interop-models";
import { agreementApi } from "pagopa-interop-api-clients";
import {
  agreementReadModelServiceBuilder,
  attributeReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  delegationReadModelServiceBuilder,
  makeDrizzleConnection,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import {
  agreementDocumentToApiAgreementDocument,
  agreementToApiAgreement,
  apiAgreementStateToAgreementState,
  fromApiCompactTenant,
} from "../model/domain/apiConverter.js";
import { agreementServiceBuilder } from "../services/agreementService.js";
import { readModelServiceBuilder } from "../services/readModelService.js";
import { config } from "../config/config.js";
import {
  activateAgreementErrorMapper,
  addConsumerDocumentErrorMapper,
  archiveAgreementErrorMapper,
  cloneAgreementErrorMapper,
  createAgreementErrorMapper,
  deleteAgreementErrorMapper,
  getAgreementErrorMapper,
  getConsumerDocumentErrorMapper,
  rejectAgreementErrorMapper,
  removeConsumerDocumentErrorMapper,
  submitAgreementErrorMapper,
  suspendAgreementErrorMapper,
  updateAgreementErrorMapper,
  upgradeAgreementErrorMapper,
  computeAgreementsStateErrorMapper,
  verifyTenantCertifiedAttributesErrorMapper,
} from "../utilities/errorMappers.js";
import { makeApiProblem } from "../model/domain/errors.js";
import { readModelServiceBuilderSQL } from "../services/readModelServiceSQL.js";

const db = makeDrizzleConnection(config);
const agreementReadModelServiceSQL = agreementReadModelServiceBuilder(db);
const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(db);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(db);
const attributeReadModelServiceSQL = attributeReadModelServiceBuilder(db);
const delegationReadModelServiceSQL = delegationReadModelServiceBuilder(db);

const oldReadModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);
const readModelServiceSQL = readModelServiceBuilderSQL(
  db,
  agreementReadModelServiceSQL,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
  attributeReadModelServiceSQL,
  delegationReadModelServiceSQL
);

const readModelService =
  config.featureFlagSQL &&
  config.readModelSQLDbHost &&
  config.readModelSQLDbPort
    ? readModelServiceSQL
    : oldReadModelService;

const pdfGenerator = await initPDFGenerator();

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
  readModelService,
  initFileManager(config),
  pdfGenerator
);

const {
  ADMIN_ROLE,
  SECURITY_ROLE,
  API_ROLE,
  M2M_ROLE,
  M2M_ADMIN_ROLE,
  INTERNAL_ROLE,
  SUPPORT_ROLE,
} = authRole;

const agreementRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const agreementRouter = ctx.router(agreementApi.agreementApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  agreementRouter
    .post("/agreements/:agreementId/submit", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE]);

        const agreement = await agreementService.submitAgreement(
          unsafeBrandId(req.params.agreementId),
          req.body,
          ctx
        );
        return res
          .status(200)
          .send(
            agreementApi.Agreement.parse(agreementToApiAgreement(agreement))
          );
      } catch (error) {
        const errorRes = makeApiProblem(error, submitAgreementErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .post("/agreements/:agreementId/activate", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

        const { data: agreement, metadata } =
          await agreementService.activateAgreement(
            unsafeBrandId(req.params.agreementId),
            ctx
          );

        setMetadataVersionHeader(res, metadata);

        return res
          .status(200)
          .send(
            agreementApi.Agreement.parse(agreementToApiAgreement(agreement))
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          activateAgreementErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .post("/agreements/:agreementId/consumer-documents", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE]);

        const document = await agreementService.addConsumerDocument(
          unsafeBrandId(req.params.agreementId),
          req.body,
          ctx
        );

        return res
          .status(200)
          .send(
            agreementApi.Document.parse(
              agreementDocumentToApiAgreementDocument(document)
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          addConsumerDocumentErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .get(
      "/agreements/:agreementId/consumer-documents/:documentId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, SUPPORT_ROLE]);

          const document = await agreementService.getAgreementConsumerDocument(
            unsafeBrandId(req.params.agreementId),
            unsafeBrandId(req.params.documentId),
            ctx
          );
          return res
            .status(200)
            .send(
              agreementApi.Document.parse(
                agreementDocumentToApiAgreementDocument(document)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getConsumerDocumentErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )

    .delete(
      "/agreements/:agreementId/consumer-documents/:documentId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE]);

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
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )

    .post("/agreements/:agreementId/suspend", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE]);

        const agreement = await agreementService.suspendAgreement(
          unsafeBrandId(req.params.agreementId),
          ctx
        );
        return res
          .status(200)
          .send(
            agreementApi.Agreement.parse(agreementToApiAgreement(agreement))
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          suspendAgreementErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .post("/agreements/:agreementId/reject", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE]);

        const agreement = await agreementService.rejectAgreement(
          unsafeBrandId(req.params.agreementId),
          req.body.reason,
          ctx
        );
        return res
          .status(200)
          .send(
            agreementApi.Agreement.parse(agreementToApiAgreement(agreement))
          );
      } catch (error) {
        const errorRes = makeApiProblem(error, rejectAgreementErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .post("/agreements/:agreementId/archive", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE]);

        const agreement = await agreementService.archiveAgreement(
          unsafeBrandId(req.params.agreementId),
          ctx
        );
        return res
          .status(200)
          .send(
            agreementApi.Agreement.parse(agreementToApiAgreement(agreement))
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          archiveAgreementErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .post("/agreements", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

        const { data: agreement, metadata } =
          await agreementService.createAgreement(
            {
              eserviceId: unsafeBrandId<EServiceId>(req.body.eserviceId),
              descriptorId: unsafeBrandId<DescriptorId>(req.body.descriptorId),
              delegationId: req.body.delegationId
                ? unsafeBrandId<DelegationId>(req.body.delegationId)
                : undefined,
            },
            ctx
          );

        setMetadataVersionHeader(res, metadata);

        return res
          .status(200)
          .send(
            agreementApi.Agreement.parse(agreementToApiAgreement(agreement))
          );
      } catch (error) {
        const errorRes = makeApiProblem(error, createAgreementErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .get("/agreements", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          SECURITY_ROLE,
          M2M_ROLE,
          M2M_ADMIN_ROLE,
          SUPPORT_ROLE,
        ]);

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
          ctx
        );

        return res.status(200).send(
          agreementApi.Agreements.parse({
            results: agreements.results.map(agreementToApiAgreement),
            totalCount: agreements.totalCount,
          })
        );
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .get("/producers", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          SECURITY_ROLE,
          SUPPORT_ROLE,
        ]);

        const producers = await agreementService.getAgreementsProducers(
          req.query.producerName,
          req.query.limit,
          req.query.offset,
          ctx
        );

        return res.status(200).send(
          agreementApi.CompactOrganizations.parse({
            results: producers.results,
            totalCount: producers.totalCount,
          })
        );
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .get("/consumers", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          SECURITY_ROLE,
          SUPPORT_ROLE,
        ]);

        const consumers = await agreementService.getAgreementsConsumers(
          req.query.consumerName,
          req.query.limit,
          req.query.offset,
          ctx
        );

        return res.status(200).send(
          agreementApi.CompactOrganizations.parse({
            results: consumers.results,
            totalCount: consumers.totalCount,
          })
        );
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .get("/agreements/:agreementId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          SECURITY_ROLE,
          M2M_ROLE,
          M2M_ADMIN_ROLE,
          SUPPORT_ROLE,
        ]);

        const { data: agreement, metadata } =
          await agreementService.getAgreementById(
            unsafeBrandId(req.params.agreementId),
            ctx
          );

        setMetadataVersionHeader(res, metadata);

        return res
          .status(200)
          .send(
            agreementApi.Agreement.parse(agreementToApiAgreement(agreement))
          );
      } catch (error) {
        const errorRes = makeApiProblem(error, getAgreementErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .delete("/agreements/:agreementId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE]);

        await agreementService.deleteAgreementById(
          unsafeBrandId(req.params.agreementId),
          ctx
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(error, deleteAgreementErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .delete(
      "/internal/delegations/:delegationId/agreements/:agreementId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [INTERNAL_ROLE]);

          await agreementService.internalDeleteAgreementAfterDelegationRevocation(
            unsafeBrandId(req.params.agreementId),
            unsafeBrandId(req.params.delegationId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deleteAgreementErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )

    .post(
      "/internal/delegations/:delegationId/agreements/:agreementId/archive",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [INTERNAL_ROLE]);

          await agreementService.internalArchiveAgreementAfterDelegationRevocation(
            unsafeBrandId(req.params.agreementId),
            unsafeBrandId(req.params.delegationId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            archiveAgreementErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )

    .post("/agreements/:agreementId/update", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE]);

        const agreement = await agreementService.updateAgreement(
          unsafeBrandId(req.params.agreementId),
          req.body,
          ctx
        );

        return res
          .status(200)
          .send(
            agreementApi.Agreement.parse(agreementToApiAgreement(agreement))
          );
      } catch (error) {
        const errorRes = makeApiProblem(error, updateAgreementErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .post("/agreements/:agreementId/upgrade", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE]);

        const agreement = await agreementService.upgradeAgreement(
          unsafeBrandId(req.params.agreementId),
          ctx
        );

        return res
          .status(200)
          .send(
            agreementApi.Agreement.parse(agreementToApiAgreement(agreement))
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          upgradeAgreementErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .post("/agreements/:agreementId/clone", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE]);

        const agreement = await agreementService.cloneAgreement(
          unsafeBrandId(req.params.agreementId),
          ctx
        );

        return res
          .status(200)
          .send(
            agreementApi.Agreement.parse(agreementToApiAgreement(agreement))
          );
      } catch (error) {
        const errorRes = makeApiProblem(error, cloneAgreementErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .post("/internal/compute/agreementsState", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [INTERNAL_ROLE]);

        await agreementService.internalComputeAgreementsStateByAttribute(
          unsafeBrandId(req.body.attributeId),
          fromApiCompactTenant(req.body.consumer),
          ctx
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          computeAgreementsStateErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .get("/agreements/filter/eservices", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          SECURITY_ROLE,
          SUPPORT_ROLE,
        ]);

        const eservices = await agreementService.getAgreementsEServices(
          {
            eserviceName: req.query.eServiceName,
            consumerIds: req.query.consumersIds.map(unsafeBrandId<TenantId>),
            producerIds: req.query.producersIds.map(unsafeBrandId<TenantId>),
          },
          req.query.limit,
          req.query.offset,
          ctx
        );

        return res.status(200).send(
          agreementApi.CompactEServices.parse({
            results: eservices.results,
            totalCount: eservices.totalCount,
          })
        );
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .get(
      "/tenants/:tenantId/eservices/:eserviceId/descriptors/:descriptorId/certifiedAttributes/validate",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, SUPPORT_ROLE]);

          const result = await agreementService.verifyTenantCertifiedAttributes(
            {
              tenantId: unsafeBrandId<TenantId>(req.params.tenantId),
              descriptorId: unsafeBrandId<DescriptorId>(
                req.params.descriptorId
              ),
              eserviceId: unsafeBrandId<EServiceId>(req.params.eserviceId),
            },
            ctx
          );
          return res
            .status(200)
            .send(agreementApi.HasCertifiedAttributes.parse(result));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            verifyTenantCertifiedAttributesErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  return agreementRouter;
};
export default agreementRouter;
