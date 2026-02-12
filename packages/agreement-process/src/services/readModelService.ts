import {
  TenantId,
  EServiceId,
  DescriptorId,
  AgreementState,
  AttributeId,
} from "pagopa-interop-models";

export type AgreementQueryFilters = {
  producerId?: TenantId | TenantId[];
  consumerId?: TenantId | TenantId[];
  eserviceId?: EServiceId | EServiceId[];
  descriptorId?: DescriptorId | DescriptorId[];
  agreementStates?: AgreementState[];
  attributeId?: AttributeId | AttributeId[];
  showOnlyUpgradeable?: boolean;
};

export type AgreementQueryFiltersWithExactConsumerIdMatch =
  AgreementQueryFilters & {
    exactConsumerIdMatch?: boolean;
    // By default, the consumerId filter also includes agreements for which the given consumerId acts as a delegate.
    // "exactConsumerIdMatch: true" restricts this to return only agreements where the given consumerId is the actual consumer.
  };

export type AgreementEServicesQueryFilters = {
  eserviceName: string | undefined;
  consumerIds: TenantId[];
  producerIds: TenantId[];
};
