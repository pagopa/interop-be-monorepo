import {
  AgreementV2,
  AttributeId,
  ClientV2,
  DelegationV2,
  EServiceId,
  EServiceTemplateV2,
  EServiceTemplateVersionId,
  EServiceV2,
  ProducerKeychainV2,
  PurposeId,
  PurposeV2,
  TenantV2,
  UserId,
} from "pagopa-interop-models";
import { HandlerCommonParams as CommonsHandlerCommonParams } from "pagopa-interop-notification-commons";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";

type HandlerCommonParams = CommonsHandlerCommonParams<ReadModelServiceSQL>;

export type AgreementHandlerParams = HandlerCommonParams & {
  agreementV2Msg?: AgreementV2;
};

export type EServiceHandlerParams = HandlerCommonParams & {
  eserviceV2Msg?: EServiceV2;
};

export type EServiceDescriptorHandlerParams = HandlerCommonParams & {
  eserviceV2Msg?: EServiceV2;
  descriptorId: string;
};

export type ClientPurposeHandlerParams = HandlerCommonParams & {
  purposeId: PurposeId;
};

export type PurposeHandlerParams = HandlerCommonParams & {
  purposeV2Msg?: PurposeV2;
};

export type TenantHandlerParams = HandlerCommonParams & {
  tenantV2Msg?: TenantV2;
  attributeId: AttributeId;
};

export type DelegationHandlerParams = HandlerCommonParams & {
  delegationV2Msg?: DelegationV2;
};

export type EserviceTemplateHandlerParams = HandlerCommonParams & {
  eserviceTemplateV2Msg?: EServiceTemplateV2;
  eserviceTemplateVersionId: EServiceTemplateVersionId;
};

export type EserviceTemplateNameUpdatedHandlerParams = HandlerCommonParams & {
  eserviceTemplateV2Msg?: EServiceTemplateV2;
  oldName?: string;
};

export type ProducerKeychainKeyHandlerParams = HandlerCommonParams & {
  producerKeychainV2Msg?: ProducerKeychainV2;
  kid: string;
};

export type ProducerKeychainUserHandlerParams = HandlerCommonParams & {
  producerKeychainV2Msg?: ProducerKeychainV2;
  userId: UserId;
};

export type ClientKeyHandlerParams = HandlerCommonParams & {
  clientV2Msg?: ClientV2;
  kid: string;
};

export type ClientUserHandlerParams = HandlerCommonParams & {
  clientV2Msg?: ClientV2;
  userId: UserId;
};

export type ProducerKeychainEServiceHandlerParams = HandlerCommonParams & {
  producerKeychainV2Msg?: ProducerKeychainV2;
  eserviceId: EServiceId;
};
