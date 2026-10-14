import { bffApi, catalogApi } from "pagopa-interop-api-clients";
import {
  CONTRACT_AUTHORITY_PUBLIC_SERVICES_MANAGERS,
  DescriptorState,
  AgreementState,
  EServiceId,
  EServiceMode,
  AttributeId,
  TenantId,
  EServiceTemplateId,
  PUBLIC_SERVICES_MANAGERS,
  Technology,
} from "pagopa-interop-models";
/*
  NOTE: Temporary file to hold all the models imported from github packages
  This file will be removed once all models are converted from scala.
 */
import { z } from "zod";

export type PersonalDataFilter = bffApi.PersonalDataFilter | undefined;

export type EServiceSortBy = catalogApi.EServiceSortBy;

export const defaultEServiceSortBy: EServiceSortBy = "CREATED_AT_DESC";

export type RequesterDelegationRole = catalogApi.RequesterDelegationRole;

export type EServiceProducerCategory = catalogApi.EServiceProducerCategory;

// Certified attribute codes of each producer category, from the SRS table
// "Categorie ente". L4 belongs to two categories, so a tenant can have more
// than one category.
export const producerCategoryAttributeCodes: Readonly<
  Record<EServiceProducerCategory, readonly string[]>
> = {
  ALTRE_PUBBLICHE_AMMINISTRAZIONI_LOCALI: [
    "C3",
    "C7",
    "C13",
    "C14",
    "L1",
    "L2",
    "L10",
    "L11",
    "L12",
    "L13",
    "L16",
    "L19",
    "L20",
    "L21",
    "L24",
    "L31",
    "L34",
    "L35",
    "L36",
    "L38",
    "L39",
    "L40",
    "L42",
    "L44",
    "L46",
    "L47",
  ],
  AZIENDE_OSPEDALIERE_ASL: ["L7", "L8", "L22"],
  COMUNI: ["L6", "L18"],
  PROVINCE_CITTA_METROPOLITANE: ["L5", "L45"],
  PUBBLICHE_AMMINISTRAZIONI_CENTRALI: ["C1", "C2", "C5", "C10", "C11"],
  ENTI_NAZIONALI_PREVIDENZA_ASSISTENZA: ["C16", "C17"],
  REGIONI_PROVINCE_AUTONOME: ["L4"],
  CONSORZI_ASSOCIAZIONI_REGIONALI: ["L4"],
  SCUOLE: ["L33"],
  UNIVERSITA_AFAM: ["L15", "L17", "L43"],
  ISTITUTI_RICERCA: ["C8", "C12", "L28"],
  STAZIONI_APPALTANTI_GESTORI_PUBBLICI_SERVIZI: [
    PUBLIC_SERVICES_MANAGERS,
    "S01",
    "SA",
    CONTRACT_AUTHORITY_PUBLIC_SERVICES_MANAGERS,
  ],
};

export type EServicesQueryFilters = {
  offset: number;
  limit: number;
  sortBy: EServiceSortBy;
  keyword?: string;
  producersIds: TenantId[];
  onlyActiveEservices?: boolean;
  subscribedByRequester?: boolean;
  requesterDelegationRoles: RequesterDelegationRole[];
  onlyTemplateInstances?: boolean;
  hasLinkedPurposeTemplates?: boolean;
  producerCategories: EServiceProducerCategory[];
  availableForRequester?: boolean;
  mode?: EServiceMode;
  onlySignalHubEnabled?: boolean;
  asyncExchange?: boolean;
};

export type ApiGetEServicesFilters = {
  eservicesIds: EServiceId[];
  producersIds: TenantId[];
  consumersIds: TenantId[];
  attributesIds: AttributeId[];
  states: DescriptorState[];
  agreementStates: AgreementState[];
  name?: string;
  technology?: Technology;
  mode?: EServiceMode;
  isSignalHubEnabled?: boolean;
  isConsumerDelegable?: boolean;
  isClientAccessDelegable?: boolean;
  delegated?: boolean;
  templatesIds: EServiceTemplateId[];
  personalData?: PersonalDataFilter;
};

export const Consumer = z.object({
  descriptorVersion: z.string(),
  descriptorState: DescriptorState,
  agreementState: AgreementState,
  consumerName: z.string(),
  consumerExternalId: z.string(),
});

export type Consumer = z.infer<typeof Consumer>;
