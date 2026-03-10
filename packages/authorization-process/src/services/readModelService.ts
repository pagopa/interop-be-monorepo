import {
  UserId,
  TenantId,
  PurposeId,
  ClientKind,
  EServiceId,
} from "pagopa-interop-models";

export type GetClientsFilters = {
  name?: string;
  userIds: UserId[];
  consumerId: TenantId | undefined;
  purposeId: PurposeId | undefined;
  kind?: ClientKind;
};

export type GetProducerKeychainsFilters = {
  name?: string;
  userIds: UserId[];
  producerId: TenantId | undefined;
  eserviceId: EServiceId | undefined;
};
