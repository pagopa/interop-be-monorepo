import { riskAnalysisFormToRiskAnalysisFormToValidate } from "pagopa-interop-commons";
import {
  Agreement,
  Attribute,
  Descriptor,
  DescriptorId,
  Document,
  EService,
  EServiceAttribute,
  EServiceEvent,
  EServiceId,
  EserviceAttributes,
  RiskAnalysis,
  Tenant,
  TenantId,
  agreementState,
  descriptorState,
  eserviceMode,
  generateId,
  technology,
  toEServiceV2,
  toReadModelAttribute,
  toReadModelEService,
  toReadModelTenant,
  toReadModelAgreement,
  DescriptorState,
  Delegation,
  EServiceTemplate,
  EServiceTemplateEvent,
  toEServiceTemplateV2,
} from "pagopa-interop-models";
import {
  ReadEvent,
  StoredEvent,
  readLastEventByStreamId,
  setupTestContainersVitest,
  writeInEventstore,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import { catalogApi } from "pagopa-interop-api-clients";
import { inject, afterEach } from "vitest";
import {
  agreementReadModelServiceBuilder,
  attributeReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  delegationReadModelServiceBuilder,
  eserviceTemplateReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { catalogServiceBuilder } from "../src/services/catalogService.js";
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";
import { config } from "../src/config/config.js";

export const {
  cleanup,
  readModelRepository,
  postgresDB,
  fileManager,
  readModelDB,
} = await setupTestContainersVitest(
  inject("readModelConfig"),
  inject("eventStoreConfig"),
  inject("fileManagerConfig"),
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

afterEach(cleanup);

export const agreements = readModelRepository.agreements;
export const eservices = readModelRepository.eservices;
export const tenants = readModelRepository.tenants;
export const attributes = readModelRepository.attributes;
export const delegations = readModelRepository.delegations;
export const eserviceTemplates = readModelRepository.eserviceTemplates;

const attributeReadModelService = attributeReadModelServiceBuilder(readModelDB);
const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);
const delegationReadModelServiceSQL =
  delegationReadModelServiceBuilder(readModelDB);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);
const eserviceTemplateReadModelServiceSQL =
  eserviceTemplateReadModelServiceBuilder(readModelDB);
const agreementReadModelServiceSQL =
  agreementReadModelServiceBuilder(readModelDB);

const oldReadModelService = readModelServiceBuilder(readModelRepository);
const readModelServiceSQL = readModelServiceBuilderSQL(
  readModelDB,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
  eserviceTemplateReadModelServiceSQL
);

const readModelService =
  config.featureFlagSQL &&
  config.readModelSQLDbHost &&
  config.readModelSQLDbPort
    ? readModelServiceSQL
    : oldReadModelService;

export const catalogService = catalogServiceBuilder(
  postgresDB,
  readModelService,
  fileManager
);

export const buildDescriptorSeedForEserviceCreation = (
  descriptor: Descriptor
): catalogApi.DescriptorSeedForEServiceCreation => ({
  audience: descriptor.audience,
  voucherLifespan: descriptor.voucherLifespan,
  dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
  dailyCallsTotal: descriptor.dailyCallsTotal,
  agreementApprovalPolicy: "AUTOMATIC",
  description: descriptor.description,
});

export const buildCreateDescriptorSeed = (
  descriptor: Descriptor
): catalogApi.EServiceDescriptorSeed => ({
  audience: descriptor.audience,
  voucherLifespan: descriptor.voucherLifespan,
  dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
  dailyCallsTotal: descriptor.dailyCallsTotal,
  agreementApprovalPolicy: "AUTOMATIC",
  description: descriptor.description,
  attributes: {
    certified: [],
    declared: [],
    verified: [],
  },
  docs: descriptor.docs.map((d) => ({
    ...d,
    kind: "DOCUMENT",
    serverUrls: [],
    documentId: d.id,
    filePath: d.path,
    fileName: d.name,
  })),
});

export const buildUpdateDescriptorSeed = (
  descriptor: Descriptor
): catalogApi.UpdateEServiceDescriptorSeed => ({
  audience: descriptor.audience,
  voucherLifespan: descriptor.voucherLifespan,
  dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
  dailyCallsTotal: descriptor.dailyCallsTotal,
  agreementApprovalPolicy: "AUTOMATIC",
  description: descriptor.description,
  attributes: {
    certified: [],
    declared: [],
    verified: [],
  },
});

export const buildRiskAnalysisSeed = (
  riskAnalysis: RiskAnalysis
): catalogApi.EServiceRiskAnalysisSeed => ({
  name: riskAnalysis.name,
  riskAnalysisForm: riskAnalysisFormToRiskAnalysisFormToValidate(
    riskAnalysis.riskAnalysisForm
  ),
});

export const getMockEService = (): EService => ({
  id: generateId(),
  name: "eservice name",
  description: "eservice description",
  createdAt: new Date(),
  producerId: generateId(),
  technology: technology.rest,
  descriptors: [],
  mode: eserviceMode.deliver,
  riskAnalysis: [],
});

export const getMockDescriptor = (state?: DescriptorState): Descriptor => ({
  id: generateId(),
  version: "1",
  docs: [],
  state: state || descriptorState.draft,
  audience: ["pagopa.it"],
  voucherLifespan: 60,
  dailyCallsPerConsumer: 10,
  dailyCallsTotal: 1000,
  createdAt: new Date(),
  serverUrls: ["pagopa.it"],
  agreementApprovalPolicy: "Automatic",
  attributes: {
    certified: [],
    verified: [],
    declared: [],
  },
  ...(state === descriptorState.archived ? { archivedAt: new Date() } : {}),
  ...(state === descriptorState.suspended ? { suspendedAt: new Date() } : {}),
  ...(state === descriptorState.deprecated ? { deprecatedAt: new Date() } : {}),
  ...(state === descriptorState.published ? { publishedAt: new Date() } : {}),
  // rejectionReasons: [],
});

export const getMockEServiceAttribute = (): EServiceAttribute => ({
  id: generateId(),
  explicitAttributeVerification: false,
});

export const getMockEServiceAttributes = (): EserviceAttributes => ({
  certified: [[getMockEServiceAttribute(), getMockEServiceAttribute()]],
  declared: [[getMockEServiceAttribute(), getMockEServiceAttribute()]],
  verified: [[getMockEServiceAttribute(), getMockEServiceAttribute()]],
});

export const buildInterfaceSeed =
  (): catalogApi.CreateEServiceDescriptorDocumentSeed => ({
    contentType: "json",
    prettyName: "prettyName",
    serverUrls: ["pagopa.it"],
    documentId: generateId(),
    kind: "INTERFACE",
    filePath: "filePath",
    fileName: "fileName",
    checksum: "checksum",
  });

export const buildDocumentSeed =
  (): catalogApi.CreateEServiceDescriptorDocumentSeed => ({
    contentType: "json",
    prettyName: "prettyName",
    serverUrls: ["pagopa.it"],
    documentId: generateId(),
    kind: "DOCUMENT",
    filePath: "filePath",
    fileName: "fileName",
    checksum: "checksum",
  });

export const getMockDocument = (): Document => ({
  name: "fileName",
  path: "filePath",
  id: generateId(),
  prettyName: "prettyName",
  contentType: "json",
  checksum: "checksum",
  uploadDate: new Date(),
});

export const getMockAgreement = ({
  eserviceId,
  descriptorId,
  producerId,
  consumerId,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  producerId: TenantId;
  consumerId: TenantId;
}): Agreement => ({
  id: generateId(),
  createdAt: new Date(),
  eserviceId,
  descriptorId,
  producerId,
  consumerId,
  state: agreementState.active,
  verifiedAttributes: [],
  certifiedAttributes: [],
  declaredAttributes: [],
  consumerDocuments: [],
  stamps: {
    submission: undefined,
    activation: undefined,
    rejection: undefined,
    suspensionByProducer: undefined,
    suspensionByConsumer: undefined,
    upgrade: undefined,
    archiving: undefined,
  },
});

export const writeEServiceInEventstore = async (
  eservice: EService
): Promise<void> => {
  const eserviceEvent: EServiceEvent = {
    type: "EServiceAdded",
    event_version: 2,
    data: { eservice: toEServiceV2(eservice) },
  };
  const eventToWrite: StoredEvent<EServiceEvent> = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    stream_id: eserviceEvent.data.eservice!.id,
    version: 0,
    event: eserviceEvent,
  };

  await writeInEventstore(eventToWrite, "catalog", postgresDB);
};

export const writeEServiceTemplateInEventstore = async (
  eserviceTemplate: EServiceTemplate
): Promise<void> => {
  const eserviceTemplateEvent: EServiceTemplateEvent = {
    type: "EServiceTemplateAdded",
    event_version: 2,
    data: { eserviceTemplate: toEServiceTemplateV2(eserviceTemplate) },
  };
  const eventToWrite: StoredEvent<EServiceTemplateEvent> = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    stream_id: eserviceTemplateEvent.data.eserviceTemplate!.id,
    version: 0,
    event: eserviceTemplateEvent,
  };

  await writeInEventstore(eventToWrite, "eservice_template", postgresDB);
};

export const addOneEService = async (eservice: EService): Promise<void> => {
  await writeEServiceInEventstore(eservice);
  await writeInReadmodel(toReadModelEService(eservice), eservices);
  await catalogReadModelServiceSQL.upsertEService(eservice, 0);
};

export const addOneAttribute = async (attribute: Attribute): Promise<void> => {
  await writeInReadmodel(toReadModelAttribute(attribute), attributes);
  await attributeReadModelService.upsertAttribute(attribute, 0);
};

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await writeInReadmodel(toReadModelTenant(tenant), tenants);
  await tenantReadModelServiceSQL.upsertTenant(tenant, 0);
};

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await writeInReadmodel(toReadModelAgreement(agreement), agreements);
  await agreementReadModelServiceSQL.upsertAgreement(agreement, 0);
};

export const addOneDelegation = async (
  delegation: Delegation
): Promise<void> => {
  await writeInReadmodel(delegation, delegations);
  await delegationReadModelServiceSQL.upsertDelegation({
    data: delegation,
    metadata: { version: 0 },
  });
};

export const readLastEserviceEvent = async (
  eserviceId: EServiceId
): Promise<ReadEvent<EServiceEvent>> =>
  await readLastEventByStreamId(eserviceId, "catalog", postgresDB);

export const addOneEServiceTemplate = async (
  eServiceTemplate: EServiceTemplate
): Promise<void> => {
  await writeEServiceTemplateInEventstore(eServiceTemplate);
  await writeInReadmodel(eServiceTemplate, eserviceTemplates);
  await eserviceTemplateReadModelServiceSQL.upsertEServiceTemplate(
    eServiceTemplate,
    0
  );
};
