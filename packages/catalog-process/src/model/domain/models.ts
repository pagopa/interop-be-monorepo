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
  EServiceTemplateVersionId,
  EserviceAttributes,
} from "pagopa-interop-models";

export type ApiGetEServicesFilters = {
  eservicesIds: EServiceId[];
  producersIds: TenantId[];
  attributesIds: AttributeId[];
  states: DescriptorState[];
  agreementStates: AgreementState[];
  name?: string;
  mode?: EServiceMode;
  isConsumerDelegable?: boolean;
  delegated?: boolean;
  templatesIds: EServiceTemplateId[];
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

export type EServiceTemplateReferences = {
  readonly id: EServiceTemplateId;
  readonly versionId: EServiceTemplateVersionId;
  readonly attributes: EserviceAttributes;
  readonly instanceLabel?: string;
};

export const consumer = z.object({
  descriptorVersion: z.string(),
  descriptorState: DescriptorState,
  agreementState: AgreementState,
  consumerName: z.string(),
  consumerExternalId: z.string(),
});

export type Consumer = z.infer<typeof consumer>;
