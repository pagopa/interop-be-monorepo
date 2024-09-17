/* eslint-disable max-params */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
import { randomUUID } from "crypto";
import AdmZip from "adm-zip";
import { bffApi, catalogApi, tenantApi } from "pagopa-interop-api-clients";
import {
  FileManager,
  WithLogger,
  createPollingByCondition,
  formatDateyyyyMMddThhmmss,
  getAllFromPaginated,
} from "pagopa-interop-commons";
import {
  DescriptorId,
  EServiceDocumentId,
  EServiceId,
  RiskAnalysisId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { BffProcessConfig, config } from "../config/config.js";
import {
  ConfigurationEservice,
  catalogApiDescriptorState,
} from "../model/api/apiTypes.js";
import {
  toBffCatalogApiDescriptorAttributes,
  toBffCatalogApiDescriptorDoc,
  toBffCatalogApiEService,
  toBffCatalogApiEserviceRiskAnalysis,
  toBffCatalogApiEserviceRiskAnalysisSeed,
  toBffCatalogApiProducerDescriptorEService,
  toBffCatalogDescriptorEService,
  toCatalogCreateEServiceSeed,
} from "../model/api/converters/catalogClientApiConverter.js";
import {
  eserviceDescriptorNotFound,
  eserviceRiskNotFound,
  invalidZipStructure,
  missingDescriptorInClonedEservice,
  noDescriptorInEservice,
} from "../model/domain/errors.js";
import { getLatestActiveDescriptor } from "../model/modelMappingUtils.js";
import { assertRequesterIsProducer } from "../model/validators.js";
import {
  AgreementProcessClient,
  AttributeProcessClient,
  CatalogProcessClient,
  TenantProcessClient,
} from "../providers/clientProvider.js";
import { BffAppContext, Headers } from "../utilities/context.js";
import {
  verifyAndCreateEServiceDocument,
  verifyAndCreateImportedDoc,
} from "../utilities/eserviceDocumentUtils.js";
import { createDescriptorDocumentZipFile } from "../utilities/fileUtils.js";
import { getLatestAgreement } from "./agreementService.js";

export type CatalogService = ReturnType<typeof catalogServiceBuilder>;

const enhanceCatalogEService =
  (
    tenantProcessClient: TenantProcessClient,
    agreementProcessClient: AgreementProcessClient,
    headers: Headers,
    requesterId: string
  ): ((eservice: catalogApi.EService) => Promise<bffApi.CatalogEService>) =>
  async (eservice: catalogApi.EService): Promise<bffApi.CatalogEService> => {
    const producerTenant = await tenantProcessClient.tenant.getTenant({
      headers,
      params: {
        id: eservice.producerId,
      },
    });

    const requesterTenant: tenantApi.Tenant =
      requesterId !== eservice.producerId
        ? await tenantProcessClient.tenant.getTenant({
            headers,
            params: {
              id: requesterId,
            },
          })
        : producerTenant;

    const latestActiveDescriptor = getLatestActiveDescriptor(eservice);

    const latestAgreement = await getLatestAgreement(
      agreementProcessClient,
      requesterId,
      eservice,
      headers
    );

    const isRequesterEqProducer = requesterId === eservice.producerId;

    return toBffCatalogApiEService(
      eservice,
      producerTenant,
      requesterTenant,
      isRequesterEqProducer,
      latestActiveDescriptor,
      latestAgreement
    );
  };

const enhanceProducerEService = (
  eservice: catalogApi.EService
): bffApi.ProducerEService => ({
  id: eservice.id,
  name: eservice.name,
  mode: eservice.mode,
  activeDescriptor: getLatestActiveDescriptor(eservice),
  draftDescriptor: eservice.descriptors.find(
    (d) => d.state === catalogApiDescriptorState.DRAFT
  ),
});

const fetchAttributes = async (
  attributeProcessClient: AttributeProcessClient,
  headers: Headers,
  descriptorAttributeIds: string[]
) =>
  await getAllFromPaginated(
    async (offset: number) =>
      await attributeProcessClient.getBulkedAttributes(descriptorAttributeIds, {
        headers,
        queries: {
          limit: 50,
          offset,
        },
      })
  );

export const retrieveEserviceDescriptor = (
  eservice: catalogApi.EService,
  descriptorId: DescriptorId
): catalogApi.EServiceDescriptor => {
  const descriptor = eservice.descriptors.find((e) => e.id === descriptorId);

  if (!descriptor) {
    throw eserviceDescriptorNotFound(eservice.id, descriptorId);
  }

  return descriptor;
};

const retrieveRiskAnalysis = (
  eservice: catalogApi.EService,
  riskAnalysisId: string
): catalogApi.EServiceRiskAnalysis => {
  const riskAnalysis = eservice.riskAnalysis.find(
    (ra) => ra.id === riskAnalysisId
  );

  if (!riskAnalysis) {
    throw eserviceRiskNotFound(eservice.id, riskAnalysisId);
  }
  return riskAnalysis;
};

const getAttributeIds = (
  descriptor: catalogApi.EServiceDescriptor
): string[] => [
  ...descriptor.attributes.certified.flatMap((atts) =>
    atts.map((att) => att.id)
  ),
  ...descriptor.attributes.declared.flatMap((atts) =>
    atts.map((att) => att.id)
  ),
  ...descriptor.attributes.verified.flatMap((atts) =>
    atts.map((att) => att.id)
  ),
];

export const fetchAllEserviceConsumers = async (
  catalogProcessClient: CatalogProcessClient,
  headers: Headers,
  eServiceId: EServiceId
): Promise<catalogApi.EServiceConsumer[]> =>
  await getAllFromPaginated(async (offset: number) =>
    catalogProcessClient.getEServiceConsumers({
      headers,
      params: {
        eServiceId,
      },
      queries: {
        offset,
        limit: 50,
      },
    })
  );

export function catalogServiceBuilder(
  catalogProcessClient: CatalogProcessClient,
  tenantProcessClient: TenantProcessClient,
  agreementProcessClient: AgreementProcessClient,
  attributeProcessClient: AttributeProcessClient,
  fileManager: FileManager,
  bffConfig: BffProcessConfig
) {
  return {
    getCatalog: async (
      { headers, authData }: WithLogger<BffAppContext>,
      queries: catalogApi.GetCatalogQueryParam
    ): Promise<bffApi.CatalogEServices> => {
      const requesterId = authData.organizationId;
      const { offset, limit } = queries;
      const eservicesResponse: catalogApi.EServices =
        await catalogProcessClient.getEServices({
          headers,
          queries: {
            ...queries,
            eservicesIds: queries.eservicesIds,
            producersIds: queries.producersIds,
            states: queries.states,
            attributesIds: queries.attributesIds,
            agreementStates: queries.agreementStates,
          },
        });

      const results = await Promise.all(
        eservicesResponse.results.map(
          enhanceCatalogEService(
            tenantProcessClient,
            agreementProcessClient,
            headers,
            requesterId
          )
        )
      );
      const response: bffApi.CatalogEServices = {
        results,
        pagination: {
          offset,
          limit,
          totalCount: eservicesResponse.totalCount,
        },
      };
      return response;
    },
    getProducerEServiceDescriptor: async (
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { authData, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.ProducerEServiceDescriptor> => {
      const requesterId = authData.organizationId;

      const eservice: catalogApi.EService =
        await catalogProcessClient.getEServiceById({
          params: {
            eServiceId: eserviceId,
          },
          headers,
        });

      assertRequesterIsProducer(requesterId, eservice);

      const descriptor = retrieveEserviceDescriptor(eservice, descriptorId);

      const descriptorAttributeIds = getAttributeIds(descriptor);

      const attributes = await fetchAttributes(
        attributeProcessClient,
        headers,
        descriptorAttributeIds
      );

      const descriptorAttributes = toBffCatalogApiDescriptorAttributes(
        attributes,
        descriptor
      );

      const requesterTenant = await tenantProcessClient.tenant.getTenant({
        headers,
        params: {
          id: requesterId,
        },
      });

      return {
        id: descriptor.id,
        version: descriptor.version,
        description: descriptor.description,
        interface:
          descriptor.interface &&
          toBffCatalogApiDescriptorDoc(descriptor.interface),
        docs: descriptor.docs.map(toBffCatalogApiDescriptorDoc),
        state: descriptor.state,
        audience: descriptor.audience,
        voucherLifespan: descriptor.voucherLifespan,
        dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
        dailyCallsTotal: descriptor.dailyCallsTotal,
        agreementApprovalPolicy: descriptor.agreementApprovalPolicy,
        attributes: descriptorAttributes,
        eservice: toBffCatalogApiProducerDescriptorEService(
          eservice,
          requesterTenant
        ),
      };
    },
    getProducerEServiceDetails: async (
      eServiceId: string,
      { headers, authData }: WithLogger<BffAppContext>
    ): Promise<bffApi.ProducerEServiceDetails> => {
      const requesterId = authData.organizationId;

      const eservice: catalogApi.EService =
        await catalogProcessClient.getEServiceById({
          params: {
            eServiceId,
          },
          headers,
        });

      assertRequesterIsProducer(requesterId, eservice);

      return {
        id: eservice.id,
        name: eservice.name,
        description: eservice.description,
        technology: eservice.technology,
        mode: eservice.mode,
        riskAnalysis: eservice.riskAnalysis.map(
          toBffCatalogApiEserviceRiskAnalysis
        ),
      };
    },
    updateEServiceDescription: async (
      { headers }: WithLogger<BffAppContext>,
      eServiceId: EServiceId,
      updateSeed: bffApi.EServiceDescriptionSeed
    ): Promise<bffApi.CreatedResource> => {
      const updatedEservice =
        await catalogProcessClient.updateEServiceDescription(updateSeed, {
          headers,
          params: {
            eServiceId,
          },
        });

      return {
        id: updatedEservice.id,
      };
    },
    createEService: async (
      eServiceSeed: bffApi.EServiceSeed,
      { headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedEServiceDescriptor> => {
      const { id, descriptors } = await catalogProcessClient.createEService(
        toCatalogCreateEServiceSeed(eServiceSeed),
        {
          headers,
        }
      );
      return { id, descriptorId: descriptors[0].id };
    },
    updateEServiceById: async (
      eServiceId: EServiceId,
      updateEServiceSeed: bffApi.UpdateEServiceSeed,
      { headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> => {
      const { id } = await catalogProcessClient.updateEServiceById(
        updateEServiceSeed,
        {
          headers,
          params: {
            eServiceId,
          },
        }
      );
      return { id };
    },
    deleteEService: async (
      eServiceId: EServiceId,
      { headers }: WithLogger<BffAppContext>
    ): Promise<void> =>
      await catalogProcessClient.deleteEService(undefined, {
        headers,
        params: {
          eServiceId,
        },
      }),
    createEServiceDocument: async (
      eServiceId: string,
      descriptorId: string,
      doc: bffApi.createEServiceDocument_Body,
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> => {
      const eService = await catalogProcessClient.getEServiceById({
        params: { eServiceId },
        headers: ctx.headers,
      });

      retrieveEserviceDescriptor(eService, unsafeBrandId(descriptorId));

      const documentId = randomUUID();

      await verifyAndCreateEServiceDocument(
        catalogProcessClient,
        fileManager,
        eService,
        doc,
        descriptorId,
        documentId,
        ctx
      );

      return { id: documentId };
    },
    getProducerEServices: async (
      eserviceName: string | undefined,
      consumersIds: string[],
      offset: number,
      limit: number,
      { headers, authData }: WithLogger<BffAppContext>
    ): Promise<bffApi.ProducerEServices> => {
      const producerId = authData.organizationId;
      const res: {
        results: catalogApi.EService[];
        totalCount: number;
      } = {
        results: [],
        totalCount: 0,
      };

      if (consumersIds.length === 0) {
        const { results, totalCount } = await catalogProcessClient.getEServices(
          {
            headers,
            queries: {
              name: eserviceName,
              producersIds: producerId,
              offset,
              limit,
            },
          }
        );

        res.results = results;
        res.totalCount = totalCount;
      } else {
        const eserviceIds = (
          await getAllFromPaginated(async (offset: number, limit: number) =>
            agreementProcessClient.getAgreements({
              headers,
              queries: {
                consumersIds,
                producersIds: [producerId],
                eservicesIds: [],
                states: [],
                offset,
                limit,
              },
            })
          )
        ).map((agreement) => agreement.eserviceId);

        const { results, totalCount } = await catalogProcessClient.getEServices(
          {
            headers,
            queries: {
              name: eserviceName,
              eservicesIds: eserviceIds,
              producersIds: producerId,
              offset,
              limit,
            },
          }
        );

        res.results = results;
        res.totalCount = totalCount;
      }

      return {
        results: res.results.map(enhanceProducerEService),
        pagination: {
          offset,
          limit,
          totalCount: res.totalCount,
        },
      };
    },
    getCatalogEServiceDescriptor: async (
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { authData, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CatalogEServiceDescriptor> => {
      const requesterId = authData.organizationId;

      const eservice = await catalogProcessClient.getEServiceById({
        params: {
          eServiceId: eserviceId,
        },
        headers,
      });

      const descriptor = retrieveEserviceDescriptor(eservice, descriptorId);
      const attributeIds = getAttributeIds(descriptor);
      const attributes = await fetchAttributes(
        attributeProcessClient,
        headers,
        attributeIds
      );

      const descriptorAttributes = toBffCatalogApiDescriptorAttributes(
        attributes,
        descriptor
      );

      const requesterTenant = await tenantProcessClient.tenant.getTenant({
        headers,
        params: {
          id: requesterId,
        },
      });
      const producerTenant = await tenantProcessClient.tenant.getTenant({
        headers,
        params: {
          id: eservice.producerId,
        },
      });
      const agreement = await getLatestAgreement(
        agreementProcessClient,
        requesterId,
        eservice,
        headers
      );

      return {
        id: descriptor.id,
        version: descriptor.version,
        description: descriptor.description,
        state: descriptor.state,
        audience: descriptor.audience,
        voucherLifespan: descriptor.voucherLifespan,
        dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
        dailyCallsTotal: descriptor.dailyCallsTotal,
        agreementApprovalPolicy: descriptor.agreementApprovalPolicy,
        attributes: descriptorAttributes,
        publishedAt: descriptor.publishedAt,
        suspendedAt: descriptor.suspendedAt,
        deprecatedAt: descriptor.deprecatedAt,
        archivedAt: descriptor.archivedAt,
        interface:
          descriptor.interface &&
          toBffCatalogApiDescriptorDoc(descriptor.interface),
        docs: descriptor.docs.map(toBffCatalogApiDescriptorDoc),
        eservice: toBffCatalogDescriptorEService(
          eservice,
          descriptor,
          producerTenant,
          agreement,
          requesterTenant
        ),
      };
    },
    getEServiceConsumers: async (
      eserviceId: EServiceId,
      { headers }: WithLogger<BffAppContext>
    ): Promise<{
      filename: string;
      file: Buffer;
    }> => {
      const eservice = await catalogProcessClient.getEServiceById({
        params: {
          eServiceId: eserviceId,
        },
        headers,
      });

      const consumers = await fetchAllEserviceConsumers(
        catalogProcessClient,
        headers,
        eserviceId
      );

      const currentDate = formatDateyyyyMMddThhmmss(new Date());
      const filename = `${currentDate}-lista-fruitori-${eservice.name}.csv`;

      const buildCsv = (consumers: catalogApi.EServiceConsumer[]): string =>
        [
          "versione,stato_versione,stato_richiesta_fruizione,fruitore,codice_ipa_fruitore",
          ...consumers.map((c) =>
            [
              c.descriptorVersion,
              c.descriptorState,
              c.agreementState,
              c.consumerName,
              c.consumerExternalId,
            ].join(",")
          ),
        ].join("\n");

      return {
        filename,
        file: Buffer.from(buildCsv(consumers)),
      };
    },
    updateEServiceRiskAnalysis: async (
      eserviceId: EServiceId,
      riskAnalysisId: RiskAnalysisId,
      riskAnalysisSeed: bffApi.EServiceRiskAnalysisSeed,
      context: WithLogger<BffAppContext>
    ): Promise<void> =>
      await catalogProcessClient.updateRiskAnalysis(riskAnalysisSeed, {
        headers: context.headers,
        params: {
          eServiceId: eserviceId,
          riskAnalysisId,
        },
      }),
    deleteEServiceRiskAnalysis: async (
      eserviceId: EServiceId,
      riskAnalysisId: RiskAnalysisId,
      context: WithLogger<BffAppContext>
    ): Promise<void> =>
      await catalogProcessClient.deleteRiskAnalysis(undefined, {
        headers: context.headers,
        params: {
          eServiceId: eserviceId,
          riskAnalysisId,
        },
      }),
    addRiskAnalysisToEService: async (
      eserviceId: EServiceId,
      riskAnalysisSeed: bffApi.EServiceRiskAnalysisSeed,
      context: WithLogger<BffAppContext>
    ): Promise<void> =>
      await catalogProcessClient.createRiskAnalysis(
        {
          name: riskAnalysisSeed.name,
          riskAnalysisForm: riskAnalysisSeed.riskAnalysisForm,
        },
        {
          headers: context.headers,
          params: {
            eServiceId: eserviceId,
          },
        }
      ),
    getEServiceRiskAnalysis: async (
      eserviceId: EServiceId,
      riskAnalysisId: RiskAnalysisId,
      context: WithLogger<BffAppContext>
    ): Promise<bffApi.EServiceRiskAnalysis> => {
      const eservice: catalogApi.EService =
        await catalogProcessClient.getEServiceById({
          params: {
            eServiceId: eserviceId,
          },
          headers: context.headers,
        });

      const riskAnalysis = retrieveRiskAnalysis(eservice, riskAnalysisId);

      return toBffCatalogApiEserviceRiskAnalysis(riskAnalysis);
    },
    getEServiceDocumentById: async (
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      documentId: EServiceDocumentId,
      ctx: WithLogger<BffAppContext>
    ): Promise<{ contentType: string; document: Buffer }> => {
      const { path, contentType } =
        await catalogProcessClient.getEServiceDocumentById({
          params: {
            eServiceId,
            descriptorId,
            documentId,
          },
          headers: ctx.headers,
        });

      const stream = await fileManager.get(
        config.eserviceDocumentsContainer,
        path,
        ctx.logger
      );

      return { contentType, document: Buffer.from(stream) };
    },
    createDescriptor: async (
      eServiceId: string,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> => {
      const eService = await catalogProcessClient.getEServiceById({
        params: { eServiceId },
        headers,
      });

      if (eService.descriptors.length === 0) {
        throw noDescriptorInEservice(eServiceId);
      }

      const retrieveLatestDescriptor = (
        descriptors: catalogApi.EServiceDescriptor[]
      ): catalogApi.EServiceDescriptor =>
        descriptors.reduce(
          (latestDescriptor, curr) =>
            parseInt(curr.version, 10) > parseInt(latestDescriptor.version, 10)
              ? curr
              : latestDescriptor,
          descriptors[0]
        );

      const previousDescriptor = retrieveLatestDescriptor(eService.descriptors);

      const cloneDocument = async (
        clonedDocumentId: string,
        doc: catalogApi.EServiceDoc
      ): Promise<catalogApi.CreateEServiceDescriptorDocumentSeed> => {
        const clonedPath = await fileManager.copy(
          config.eserviceDocumentsContainer,
          doc.path,
          config.eserviceDocumentsPath,
          clonedDocumentId,
          doc.name,
          logger
        );

        return {
          documentId: clonedDocumentId,
          kind: "DOCUMENT",
          contentType: doc.contentType,
          prettyName: doc.prettyName,
          fileName: doc.name,
          filePath: clonedPath,
          checksum: doc.checksum,
          serverUrls: [],
        };
      };

      const clonedDocumentsCalls = previousDescriptor.docs.map((doc) =>
        cloneDocument(randomUUID(), doc)
      );

      const clonedDocuments = await Promise.all(clonedDocumentsCalls);

      const { id } = await catalogProcessClient.createDescriptor(
        {
          description: previousDescriptor.description,
          audience: [],
          voucherLifespan: previousDescriptor.voucherLifespan,
          dailyCallsPerConsumer: previousDescriptor.dailyCallsPerConsumer,
          dailyCallsTotal: previousDescriptor.dailyCallsTotal,
          agreementApprovalPolicy: previousDescriptor.agreementApprovalPolicy,
          attributes: previousDescriptor.attributes,
          docs: clonedDocuments,
        },
        {
          headers,
          params: {
            eServiceId,
          },
        }
      );
      return { id };
    },
    deleteDraft: async (
      eServiceId: string,
      descriptorId: string,
      { headers }: WithLogger<BffAppContext>
    ): Promise<void> =>
      await catalogProcessClient.deleteDraft(undefined, {
        headers,
        params: {
          descriptorId,
          eServiceId,
        },
      }),
    updateDraftDescriptor: async (
      eServiceId: string,
      descriptorId: string,
      updateEServiceDescriptorSeed: bffApi.UpdateEServiceDescriptorSeed,
      { headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> => {
      const { id } = await catalogProcessClient.updateDraftDescriptor(
        updateEServiceDescriptorSeed,
        {
          headers,
          params: {
            descriptorId,
            eServiceId,
          },
        }
      );
      return { id };
    },
    deleteEServiceDocumentById: async (
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      documentId: EServiceDocumentId,
      ctx: WithLogger<BffAppContext>
    ): Promise<void> => {
      await catalogProcessClient.deleteEServiceDocumentById(undefined, {
        params: {
          eServiceId,
          descriptorId,
          documentId,
        },
        headers: ctx.headers,
      });
    },
    cloneEServiceByDescriptor: async (
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedEServiceDescriptor> => {
      const eService = await catalogProcessClient.cloneEServiceByDescriptor(
        undefined,
        {
          params: {
            eServiceId,
            descriptorId,
          },
          headers: ctx.headers,
        }
      );
      const eServiceDescriptorId = eService.descriptors.at(0)?.id;
      if (!eServiceDescriptorId) {
        throw missingDescriptorInClonedEservice(eService.id);
      }
      return { id: eService.id, descriptorId: eServiceDescriptorId };
    },
    activateDescriptor: async (
      eServiceId: EServiceId,
      descriptorId: string,
      { headers }: WithLogger<BffAppContext>
    ): Promise<void> =>
      await catalogProcessClient.activateDescriptor(undefined, {
        headers,
        params: {
          eServiceId,
          descriptorId,
        },
      }),
    updateDescriptor: async (
      eServiceId: EServiceId,
      descriptorId: string,
      seed: catalogApi.UpdateEServiceDescriptorQuotasSeed,
      { headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> =>
      await catalogProcessClient.updateDescriptor(seed, {
        headers,
        params: {
          eServiceId,
          descriptorId,
        },
      }),
    publishDescriptor: async (
      eServiceId: EServiceId,
      descriptorId: string,
      { headers }: WithLogger<BffAppContext>
    ): Promise<void> =>
      await catalogProcessClient.publishDescriptor(undefined, {
        headers,
        params: {
          eServiceId,
          descriptorId,
        },
      }),
    suspendDescriptor: async (
      eServiceId: EServiceId,
      descriptorId: string,
      { headers }: WithLogger<BffAppContext>
    ): Promise<void> =>
      await catalogProcessClient.suspendDescriptor(undefined, {
        headers,
        params: {
          eServiceId,
          descriptorId,
        },
      }),
    updateEServiceDocumentById: async (
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      documentId: EServiceDocumentId,
      updateEServiceDescriptorDocumentSeed: bffApi.UpdateEServiceDescriptorDocumentSeed,
      context: WithLogger<BffAppContext>
    ): Promise<bffApi.EServiceDoc> =>
      await catalogProcessClient.updateEServiceDocumentById(
        updateEServiceDescriptorDocumentSeed,
        {
          params: {
            eServiceId,
            descriptorId,
            documentId,
          },
          headers: context.headers,
        }
      ),
    exportEServiceDescriptor: async (
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { authData, headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.FileResource> => {
      const requesterId = authData.organizationId;

      const eservice = await catalogProcessClient.getEServiceById({
        params: {
          eServiceId: eserviceId,
        },
        headers,
      });

      assertRequesterIsProducer(requesterId, eservice);

      const zipFolderName = `${eservice.id}_${descriptorId}`;
      const zipFile = await createDescriptorDocumentZipFile(
        bffConfig.eserviceDocumentsContainer,
        fileManager,
        logger,
        zipFolderName,
        eservice,
        descriptorId
      );

      const zipFilePath = `${bffConfig.exportEservicePath}/${requesterId}`;
      const zipFileName = `${zipFolderName}.zip`;
      await fileManager.storeBytes(
        {
          bucket: bffConfig.exportEserviceContainer,
          path: zipFilePath,
          name: zipFileName,
          content: Buffer.from(zipFile),
        },
        logger
      );

      const url = await fileManager.generateGetPresignedUrl(
        bffConfig.exportEserviceContainer,
        zipFilePath,
        zipFileName,
        bffConfig.presignedUrlGetDurationMinutes
      );

      return {
        filename: zipFileName,
        url,
      };
    },
    generatePutPresignedUrl: async (
      filename: string,
      { authData }: WithLogger<BffAppContext>
    ): Promise<bffApi.FileResource> => {
      const path = `${bffConfig.importEservicePath}/${authData.organizationId}`;
      const url = await fileManager.generatePutPresignedUrl(
        bffConfig.importEserviceContainer,
        path,
        filename,
        bffConfig.presignedUrlPutDurationMinutes
      );

      return {
        filename,
        url,
      };
    },
    importEService: async (
      fileResource: bffApi.FileResource,
      context: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedEServiceDescriptor> => {
      const tenantId = context.authData.organizationId;
      const zipFile = await fileManager.get(
        config.importEserviceContainer,
        `${config.importEservicePath}/${tenantId}/${fileResource.filename}`,
        context.logger
      );

      const zip = new AdmZip(Buffer.from(zipFile));

      const rootFolderName = fileResource.filename.replace(".zip", "");

      const entriesMap = zip.getEntries().reduce((map, entry) => {
        map.set(entry.entryName.replace(rootFolderName + "/", ""), entry);
        return map;
      }, new Map<string, AdmZip.IZipEntry>());

      const configurationEntry = entriesMap.get("configuration.json");
      if (!configurationEntry) {
        throw invalidZipStructure("Error reading configuration.json");
      }

      const jsonContent = configurationEntry.getData().toString("utf8");
      const { data: importedEservice, error } = ConfigurationEservice.safeParse(
        JSON.parse(jsonContent)
      );

      if (error) {
        throw invalidZipStructure("Error decoding configuration.json");
      }
      const docsPath = importedEservice.descriptor.docs.map((doc) =>
        entriesMap.get(doc.path)?.getData()
      );
      if (docsPath.some((doc) => doc === undefined)) {
        throw invalidZipStructure("Error reading docs");
      }

      const descriptorInterface = importedEservice.descriptor.interface;

      if (
        descriptorInterface &&
        entriesMap.get(descriptorInterface.path) === undefined
      ) {
        throw invalidZipStructure("Error reading interface");
      }

      const allowedFiles = [
        "configuration.json",
        "documents/",
        importedEservice.descriptor.interface?.path,
        ...importedEservice.descriptor.docs.map((doc) => doc.path),
      ].filter(
        (path: string | undefined): path is string => path !== undefined
      );

      const filePaths = Array.from(entriesMap.keys());

      const difference = filePaths.filter(
        (item) => !allowedFiles.includes(item)
      );
      if (difference.length > 0) {
        throw invalidZipStructure(
          `Not allowed files found: ${difference.join(", ")}`
        );
      }

      const eserviceSeed: catalogApi.EServiceSeed = {
        name: importedEservice.name,
        description: importedEservice.description,
        technology: importedEservice.technology,
        mode: importedEservice.mode,
        descriptor: {
          description: importedEservice.descriptor.description,
          audience: importedEservice.descriptor.audience,
          voucherLifespan: importedEservice.descriptor.voucherLifespan,
          dailyCallsPerConsumer:
            importedEservice.descriptor.dailyCallsPerConsumer,
          dailyCallsTotal: importedEservice.descriptor.dailyCallsTotal,
          agreementApprovalPolicy:
            importedEservice.descriptor.agreementApprovalPolicy,
        },
      };

      const pollEServiceById = createPollingByCondition(() =>
        catalogProcessClient.getEServiceById({
          params: {
            eServiceId: eservice.id,
          },
          headers: context.headers,
        })
      );

      const eservice = await catalogProcessClient.createEService(eserviceSeed, {
        headers: context.headers,
      });
      await pollEServiceById((result) => result.descriptors.length > 0);

      for (const riskAnalysis of importedEservice.riskAnalysis) {
        try {
          await catalogProcessClient.createRiskAnalysis(
            toBffCatalogApiEserviceRiskAnalysisSeed(riskAnalysis),
            {
              headers: context.headers,
              params: {
                eServiceId: eservice.id,
              },
            }
          );
        } catch (error) {
          await catalogProcessClient.deleteEService(undefined, {
            headers: context.headers,
            params: {
              eServiceId: eservice.id,
            },
          });
        }
        await pollEServiceById((result) => result.riskAnalysis.length > 0);
      }

      const descriptor = eservice.descriptors[0];
      if (descriptorInterface) {
        await verifyAndCreateImportedDoc(
          catalogProcessClient,
          fileManager,
          eservice,
          descriptor,
          entriesMap,
          descriptorInterface,
          "INTERFACE",
          context
        );
      }
      await pollEServiceById((result) =>
        result.descriptors.some(
          (d) => d.id === descriptor.id && d.interface !== undefined
        )
      );

      for (const doc of importedEservice.descriptor.docs) {
        await verifyAndCreateImportedDoc(
          catalogProcessClient,
          fileManager,
          eservice,
          descriptor,
          entriesMap,
          doc,
          "DOCUMENT",
          context
        );
        await pollEServiceById((result) =>
          result.descriptors.some(
            (d) =>
              d.id === descriptor.id &&
              d.docs.some((d) => d.prettyName === doc.prettyName)
          )
        );
      }

      return {
        id: eservice.id,
        descriptorId: eservice.descriptors[0].id,
      };
    },
  };
}
