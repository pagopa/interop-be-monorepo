import {
  ExportedAgreement,
  ExportedCollection,
  ExportedEService,
  ExportedPurpose,
  ExportedTenant,
  ExportedDelegation,
  ExportedEServiceTemplate,
} from "../config/models/models.js";
import { arrayToNdjson, splitArrayIntoChunks } from "../utils/helperUtils.js";

type ExportedData = [
  collection: ExportedCollection,
  ndjsonFiles: string[],
  count: number,
];

const generateNdjsonFiles = (
  data: Array<
    | ExportedAgreement
    | ExportedEService
    | ExportedPurpose
    | ExportedTenant
    | ExportedDelegation
    | ExportedEServiceTemplate
  >,
  exportTimestamp: Date
): string[] => {
  const dataWithTimestamp = data.map((item) => ({ ...item, exportTimestamp }));
  const dataChunks = splitArrayIntoChunks(dataWithTimestamp, 1000);

  return dataChunks.map(arrayToNdjson);
};

export const buildDataToExport = (
  tenants: ExportedTenant[],
  eservices: ExportedEService[],
  agreements: ExportedAgreement[],
  purposes: ExportedPurpose[],
  delegations: ExportedDelegation[],
  eserviceTemplates: ExportedEServiceTemplate[],
  exportTimestamp: Date
  // eslint-disable-next-line max-params
): ExportedData[] => [
  ["tenants", generateNdjsonFiles(tenants, exportTimestamp), tenants.length],
  [
    "eservices",
    generateNdjsonFiles(eservices, exportTimestamp),
    eservices.length,
  ],
  [
    "agreements",
    generateNdjsonFiles(agreements, exportTimestamp),
    agreements.length,
  ],
  ["purposes", generateNdjsonFiles(purposes, exportTimestamp), purposes.length],
  [
    "delegations",
    generateNdjsonFiles(delegations, exportTimestamp),
    delegations.length,
  ],
  [
    "eservice-templates",
    generateNdjsonFiles(eserviceTemplates, exportTimestamp),
    eserviceTemplates.length,
  ],
];
