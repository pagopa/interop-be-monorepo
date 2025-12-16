/*
  NOTE: Temporary file to hold all the models imported from github packages
  This file will be removed once all models are converted from scala.
 */
import { z } from "zod";
import {
  DescriptorState,
  AgreementState,
  DescriptorId,
  EServiceId,
  EServiceMode,
  AttributeId,
  TenantId,
  EServiceTemplateId,
  Technology,
} from "pagopa-interop-models";
import { bffApi } from "pagopa-interop-api-clients";

export type PersonalDataFilter = bffApi.PersonalDataFilter | undefined;

export type ApiGetEServicesFilters = {
  eservicesIds: EServiceId[];
  producersIds: TenantId[];
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

export type EServiceDocument = {
  readonly eserviceId: EServiceId;
  readonly descriptorId: DescriptorId;
  readonly document: {
    readonly name: string;
    readonly contentType: string;
    readonly prettyName: string;
    readonly path: string;
    readonly checksum: string;
    readonly uploadDate: number;
  };
  readonly isInterface: boolean;
  readonly serverUrls: string[];
};

export const Consumer = z.object({
  descriptorVersion: z.string(),
  descriptorState: DescriptorState,
  agreementState: AgreementState,
  consumerName: z.string(),
  consumerExternalId: z.string(),
});

export type Consumer = z.infer<typeof Consumer>;
