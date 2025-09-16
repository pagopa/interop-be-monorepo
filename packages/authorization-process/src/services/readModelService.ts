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
  consumerId: TenantId;
  purposeId: PurposeId | undefined;
  kind?: ClientKind;
};

export type GetProducerKeychainsFilters = {
  name?: string;
  userIds: UserId[];
  producerId: TenantId;
  eserviceId: EServiceId | undefined;
};
