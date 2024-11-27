/* eslint-disable functional/immutable-data */
import {
  AgreementSQL,
  AgreementState,
  AttributeId,
  Descriptor,
  DescriptorId,
  DescriptorState,
  Document,
  documentKind,
  EService,
  EServiceDocumentId,
  EServiceId,
  EServiceMode,
  EserviceRiskAnalysisSQL,
  EServiceSQL,
  genericInternalError,
  RiskAnalysis,
  RiskAnalysisAnswerSQL,
  RiskAnalysisId,
  TenantId,
} from "pagopa-interop-models";
import { AuthData, ReadModelRepositorySQL } from "pagopa-interop-commons";
import { match } from "ts-pattern";
import pgPromise from "pg-promise";
import {
  prepareDeleteDescriptor,
  prepareDeleteDocument,
  prepareDeleteEservice,
  prepareDeleteRiskAnalysis,
  prepareInsertDescriptor,
  prepareInsertDescriptorAttribute,
  prepareInsertDescriptorDocument,
  prepareInsertEservice,
  prepareInsertRiskAnalysis,
  prepareInsertRiskAnalysisAnswer,
  prepareReadDescriptorAttributesByDescriptorIds,
  prepareReadDescriptorsByEserviceIds,
  prepareReadDocumentsByDescriptorIds,
  prepareReadRiskAnalysesAnswersByFormIds,
  prepareReadRiskAnalysesByEserviceIds,
  prepareUpdateDescriptor,
  prepareUpdateDescriptorDocument,
  prepareUpdateEservice,
} from "./statements.js";
import {
  descriptorToDescriptorSQL,
  documentToDocumentSQL,
  eserviceToEserviceSQL,
  splitDescriptorIntoObjectsSQL,
  splitEserviceIntoObjectsSQL,
  splitRiskAnalysisIntoObjectsSQL,
} from "./splitters.js";
import { eserviceSQLArraytoEserviceArray } from "./aggregators.js";

// "EServiceDeleted" -> cascade delete
export const deleteEService = async (
  eserviceId: EServiceId,
  readModelRepositorySQL: ReadModelRepositorySQL
): Promise<void> => {
  const deleteStatement = prepareDeleteEservice(eserviceId);
  await readModelRepositorySQL.deleteItem(deleteStatement);
};

// "EServiceAdded" -> create in all the tables -> TODO must handle also upsert!
export const upsertEService = async (
  eservice: EService,
  readModelRepositorySQL: ReadModelRepositorySQL
): Promise<void> => {
  // cascade delete at the beginning (related to upsert)
  await deleteEService(eservice.id, readModelRepositorySQL);

  const { eserviceSQL, descriptorsSQL, attributesSQL, documentsSQL } =
    splitEserviceIntoObjectsSQL(eservice);

  const insertEserviceStatement = prepareInsertEservice(eserviceSQL);
  const insertDescriptorsStatements = descriptorsSQL.map((d) =>
    prepareInsertDescriptor(d)
  );
  const insertAttributesStatements = attributesSQL.map((a) =>
    prepareInsertDescriptorAttribute(a)
  );
  const insertDocumentsStatements = documentsSQL.map((d) =>
    prepareInsertDescriptorDocument(d)
  );

  // to do: test if consecutive write operations break reference (for example the eservice entry is not committed when trying to write the descriptor; maybe 4 different transactions, one per table)
  await readModelRepositorySQL.writeItems([
    insertEserviceStatement,
    ...insertDescriptorsStatements,
    ...insertAttributesStatements,
    ...insertDocumentsStatements,
  ]);
};

// "DraftEServiceUpdated" -> update only in eservice table? Double check
// Problem: technology change brings interface deletions. We don't have the old technology in the event. We have to read the entry from the db. Alternatives? Replace interface in every case: if no interface in the incoming eservice, then delete the interface if any (we don't know if there was one already without querying)
// more: mode change brings risk analysis deletion (when RECEIVE -> DELIVER)
// better delete and replace?
// if so, use upsertEService()

// "EServiceCloned" -> create in all the tables
// identical to addEService()

// "EServiceDescriptorAdded" -> create in all the tables starting from descriptor
export const addDescriptor = async (
  eserviceId: EServiceId,
  descriptor: Descriptor,
  readModelRepositorySQL: ReadModelRepositorySQL
): Promise<void> => {
  const { descriptorSQL, attributesSQL, documentsSQL } =
    splitDescriptorIntoObjectsSQL(eserviceId, descriptor);

  const insertDescriptorStatements = prepareInsertDescriptor(descriptorSQL);

  const insertAttributesStatements = attributesSQL.map((a) =>
    prepareInsertDescriptorAttribute(a)
  );
  const insertDocumentsStatements = documentsSQL.map((d) =>
    prepareInsertDescriptorDocument(d)
  );

  await readModelRepositorySQL.writeItems([
    insertDescriptorStatements,
    ...insertAttributesStatements,
    ...insertDocumentsStatements,
  ]);
};

// "EServiceDraftDescriptorDeleted" -> cascade delete from descriptor
export const deleteDescriptor = async (
  descriptorId: DescriptorId,
  readModelRepositorySQL: ReadModelRepositorySQL
): Promise<void> => {
  const deleteStatement = prepareDeleteDescriptor(descriptorId);
  await readModelRepositorySQL.deleteItem(deleteStatement);
};

// "EServiceDraftDescriptorUpdated" -> cascade replace in all the tables starting from descriptor
export const replaceDescriptor = async (
  eserviceId: EServiceId,
  descriptor: Descriptor,
  readModelRepositorySQL: ReadModelRepositorySQL
): Promise<void> => {
  await deleteDescriptor(descriptor.id, readModelRepositorySQL);

  await addDescriptor(eserviceId, descriptor, readModelRepositorySQL);
};

// "EServiceDescriptorQuotasUpdated" -> update only in descriptor table
export const updateDescriptor = async (
  eserviceId: EServiceId,
  descriptor: Descriptor,
  readModelRepositorySQL: ReadModelRepositorySQL
): Promise<void> => {
  const descriptorSQL = descriptorToDescriptorSQL(eserviceId, descriptor);
  const updateStatement = prepareUpdateDescriptor(descriptorSQL);

  await readModelRepositorySQL.writeItem(updateStatement);
};

// "EServiceDescriptorActivated" -> update only in descriptor table
// identical to updateDescriptor()

// "EServiceDescriptorArchived" -> update only in descriptor table
// identical to updateDescriptor()

// "EServiceDescriptorPublished" -> update only in descriptor table (for both the published and the archived/deprecated one)
export const publishDescriptor = async (
  publishedDescriptor: Descriptor,
  previousDescriptor: Descriptor | undefined,
  eserviceId: EServiceId,
  readModelRepositorySQL: ReadModelRepositorySQL
): Promise<void> => {
  const publishedDescriptorSQL = descriptorToDescriptorSQL(
    eserviceId,
    publishedDescriptor
  );
  const updateStatement = prepareUpdateDescriptor(publishedDescriptorSQL);

  if (previousDescriptor) {
    const previousDescriptorSQL = descriptorToDescriptorSQL(
      eserviceId,
      previousDescriptor
    );

    const updateStatementPreviousDescriptor = prepareUpdateDescriptor(
      previousDescriptorSQL
    );
    await readModelRepositorySQL.writeItems([
      updateStatement,
      updateStatementPreviousDescriptor,
    ]);
  } else {
    await readModelRepositorySQL.writeItem(updateStatement);
  }
};

// "EServiceDescriptorSuspended" -> update only in descriptor table
// identical to updateDescriptor()

// "EServiceDescriptorInterfaceAdded" -> create in document table
// IMPORTANT: beware of server urls in descriptor table
export const addInterface = async (
  eserviceId: EServiceId,
  descriptor: Descriptor,
  readModelRepositorySQL: ReadModelRepositorySQL
): Promise<void> => {
  const interfaceDocument = descriptor.interface;

  if (!interfaceDocument) {
    throw genericInternalError("");
  }

  const documentSQL = documentToDocumentSQL(
    interfaceDocument,
    documentKind.descriptorInterface,
    descriptor.id
  );

  const insertDocumentStatement = prepareInsertDescriptorDocument(documentSQL);
  await readModelRepositorySQL.writeItem(insertDocumentStatement);

  // update in descriptor table only for server urls. Todo: make more specific query?
  await updateDescriptor(eserviceId, descriptor, readModelRepositorySQL);
};

// "EServiceDescriptorDocumentAdded" -> create in document table
export const addDocument = async (
  document: Document,
  descriptorId: DescriptorId,
  readModelRepositorySQL: ReadModelRepositorySQL
): Promise<void> => {
  const documentSQL = documentToDocumentSQL(
    document,
    documentKind.descriptorDocument,
    descriptorId
  );

  const insertDocumentStatement = prepareInsertDescriptorDocument(documentSQL);
  await readModelRepositorySQL.writeItem(insertDocumentStatement);
};

// "EServiceDescriptorInterfaceUpdated" -> update only in document table
export const updateDocument = async (
  descriptorId: DescriptorId,
  document: Document,
  readModelRepositorySQL: ReadModelRepositorySQL
): Promise<void> => {
  const documentSQL = documentToDocumentSQL(
    document,
    documentKind.descriptorDocument,
    descriptorId
  );
  const updateDocumentStatement = prepareUpdateDescriptorDocument(documentSQL);

  await readModelRepositorySQL.writeItem(updateDocumentStatement);
};

// "EServiceDescriptorDocumentUpdated" -> update only in document table
// identical to updateDocument

// "EServiceDescriptorInterfaceDeleted" -> delete in document table
// IMPORTANT: beware of serverUrls in descriptor table
export const deleteInterface = async (
  eserviceId: EServiceId,
  descriptor: Descriptor,
  interfaceId: EServiceDocumentId,
  readModelRepositorySQL: ReadModelRepositorySQL
): Promise<void> => {
  const deleteStatement = prepareDeleteDocument(interfaceId);
  await readModelRepositorySQL.deleteItem(deleteStatement);

  // update in descriptor table only for server urls. Todo: make more specific query?
  await updateDescriptor(eserviceId, descriptor, readModelRepositorySQL);
};

// "EServiceDescriptorDocumentDeleted" -> delete in document table
export const deleteDocument = async (
  documentId: EServiceDocumentId,
  readModelRepositorySQL: ReadModelRepositorySQL
): Promise<void> => {
  const deleteStatement = prepareDeleteDocument(documentId);
  await readModelRepositorySQL.deleteItem(deleteStatement);
};

// "EServiceRiskAnalysisAdded" -> add in riskAnalysis and riskAnalysisAnswers tables
export const addRiskAnalysis = async (
  eserviceId: EServiceId,
  newRiskAnalysis: RiskAnalysis,
  readModelRepositorySQL: ReadModelRepositorySQL
): Promise<void> => {
  const { eserviceRiskAnalysisSQL, riskAnalysisAnswersSQL } =
    splitRiskAnalysisIntoObjectsSQL(newRiskAnalysis, eserviceId);

  const insertRiskAnalysisStatement = prepareInsertRiskAnalysis(
    eserviceRiskAnalysisSQL
  );
  const insertRiskAnalysiAnswersStatements = riskAnalysisAnswersSQL.map(
    prepareInsertRiskAnalysisAnswer
  );

  await readModelRepositorySQL.writeItems([
    insertRiskAnalysisStatement,
    ...insertRiskAnalysiAnswersStatements,
  ]);
};

// "EServiceRiskAnalysisUpdated" -> delete and replace in riskAnalysis and riskAnalysisAnswers tables
export const updateRiskAnalysis = async (
  riskAnalysis: RiskAnalysis,
  eserviceId: EServiceId,
  readModelRepositorySQL: ReadModelRepositorySQL
): Promise<void> => {
  await deleteRiskAnalysis(riskAnalysis.id, readModelRepositorySQL);
  await addRiskAnalysis(eserviceId, riskAnalysis, readModelRepositorySQL);
};

// "EServiceRiskAnalysisDeleted" -> delete cascade from riskAnalysis table (important beware of purposes using that risk analysis)
export const deleteRiskAnalysis = async (
  riskAnalysisId: RiskAnalysisId,
  readModelRepositorySQL: ReadModelRepositorySQL
): Promise<void> => {
  const deleteRiskAnalysisStatement = prepareDeleteRiskAnalysis(riskAnalysisId);

  await readModelRepositorySQL.deleteItem(deleteRiskAnalysisStatement);
};

// "EServiceDescriptionUpdated" -> update only in eservice table
export const updateEservice = async (
  eservice: EService,
  readModelRepositorySQL: ReadModelRepositorySQL
): Promise<void> => {
  const eserviceSQL = eserviceToEserviceSQL(eservice);
  const updateEserviceStatement = prepareUpdateEservice(eserviceSQL);
  await readModelRepositorySQL.writeItem(updateEserviceStatement);
};

// listing
export const listEservices = async ({
  readModelRepositorySQL,
  authData,
  eservicesIds,
  producersIds,
  attributesIds,
  states,
  agreementStates,
  name,
  mode,
  offset,
  limit,
}: {
  readModelRepositorySQL: ReadModelRepositorySQL;
  authData: AuthData;
  eservicesIds: EServiceId[];
  producersIds: TenantId[];
  attributesIds: AttributeId[];
  states: DescriptorState[];
  agreementStates: AgreementState[];
  name?: string;
  mode?: EServiceMode;
  offset: number;
  limit: number;
}): Promise<EService[]> => {
  // TODO implement actual query
  const resultOfMainQuery = await getEservices({
    readModelRepositorySQL,
    authData,
    eservicesIds,
    producersIds,
    attributesIds,
    states,
    agreementStates,
    name,
    mode,
    offset,
    limit,
  });

  const eservicesIdsToReturn = resultOfMainQuery.map((e) => e.id);
  const readDescriptorsStatement =
    prepareReadDescriptorsByEserviceIds(eservicesIdsToReturn);
  const descriptorsSQL = await readModelRepositorySQL.readItems(
    readDescriptorsStatement
  ); // TODO readItems results should then get parsed

  const descriptorsIds = descriptorsSQL.map((d) => d.id);
  const readDocumentsStatement =
    prepareReadDocumentsByDescriptorIds(descriptorsIds);
  const documentsSQL = await readModelRepositorySQL.readItems(
    readDocumentsStatement
  ); // TODO readItems results should then get parsed

  const readAttributesStatement =
    prepareReadDescriptorAttributesByDescriptorIds(descriptorsIds);

  const attributesSQL = await readModelRepositorySQL.readItems(
    readAttributesStatement
  ); // TODO readItems results should then get parsed

  const readRiskAnalysesStatement =
    prepareReadRiskAnalysesByEserviceIds(eservicesIdsToReturn);

  const eserviceRiskAnalysesSQL = (await readModelRepositorySQL.readItems(
    readRiskAnalysesStatement
  )) as EserviceRiskAnalysisSQL[]; // TODO parsing

  const riskAnalysesformIds = eserviceRiskAnalysesSQL.map(
    (ra) => ra.risk_analysis_form_id
  );

  const readRiskAnalysesAnswersStatement =
    prepareReadRiskAnalysesAnswersByFormIds(riskAnalysesformIds);

  const riskAnalysesAnswers = (await readModelRepositorySQL.readItems(
    readRiskAnalysesAnswersStatement
  )) as RiskAnalysisAnswerSQL[];

  return eserviceSQLArraytoEserviceArray(
    resultOfMainQuery,
    eserviceRiskAnalysesSQL,
    riskAnalysesAnswers,
    descriptorsSQL,
    documentsSQL,
    attributesSQL
  );
};

/*
query for getEservices
*/

const getEservices = async ({
  readModelRepositorySQL,
  authData,
  eservicesIds,
  producersIds,
  attributesIds,
  states,
  agreementStates,
  name,
  mode,
  offset,
  limit,
}: {
  readModelRepositorySQL: ReadModelRepositorySQL;
  authData: AuthData;
  eservicesIds: EServiceId[];
  producersIds: TenantId[];
  attributesIds: AttributeId[];
  states: DescriptorState[];
  agreementStates: AgreementState[];
  name?: string;
  mode?: EServiceMode;
  offset: number;
  limit: number;
}): Promise<EServiceSQL[]> => {
  const ids = await match(agreementStates.length)
    .with(0, () => eservicesIds)
    .otherwise(async () =>
      (
        await listAgreements({
          eservicesIds,
          consumersIds: [authData.organizationId],
          producersIds: [],
          states: agreementStates,
        })
      ).map((a) => a.eservice_id)
    );
  if (agreementStates.length > 0 && ids.length === 0) {
    return [];
  }

  const conditions = [];
  // eslint-disable-next-line functional/no-let
  let parametersCount = 1;
  const parametersArray = [];

  // nameFilter
  if (name) {
    conditions.push(`(eservice.name LIKE %$${parametersCount}%)`);
    parametersArray.push(name);
    parametersCount++;
  }

  // idsFilter
  if (ids.length > 0) {
    conditions.push(`(eservice.id IN $${parametersCount})`);
    parametersArray.push(ids);
    parametersCount++;
  }

  // producersIdsFilter
  if (producersIds.length > 0) {
    conditions.push(`(eservice.producer_id IN $${parametersCount})`);
    parametersArray.push(producersIds);
    parametersCount++;
  }

  // descriptorsStateFilter
  if (states.length > 0) {
    conditions.push(
      `(EXISTS (SELECT 1 FROM descriptor WHERE descriptor.eservice_id = eservice.id AND descriptor.states IN $${parametersCount}))`
    );
    parametersArray.push(states);
    parametersCount++;
  }

  // attributesFilter
  if (attributesIds.length > 0) {
    conditions.push(
      `(descriptor_attribute = ANY ($${parametersCount}) AND descriptor_attribute.descriptor_id IN SELECT id FROM readmodel.descriptor WHERE id = eservice.id)`
    );
    parametersArray.push(attributesIds);
    parametersCount++;
  }

  // visibilityFilter
  // TODO

  // modeFilter
  if (mode) {
    conditions.push(`(eservice.mode = $${parametersCount})`);
    parametersArray.push(mode);
    parametersCount++;
  }

  const readEservicesStatement = new pgPromise.PreparedStatement({
    name: "get-eservices",
    text: `SELECT * FROM readmodel.eservice WHERE ${conditions.join(
      " AND "
    )} LIMIT $${parametersCount++} OFFSET $${parametersCount++}`,
    values: [...parametersArray, limit, offset],
  });

  const eservicesSQL = await readModelRepositorySQL.readItems(
    readEservicesStatement
  );

  return eservicesSQL as EServiceSQL[];
};

const listAgreements = ({
  eservicesIds,
  consumersIds,
  producersIds,
  states,
}: {
  eservicesIds: EServiceId[];
  consumersIds: TenantId[];
  producersIds: TenantId[];
  states: AgreementState[];
}): Promise<AgreementSQL[]> => {
  // eslint-disable-next-line no-console
  console.log(eservicesIds, consumersIds, producersIds, states);
  return Promise.resolve([]);
};
