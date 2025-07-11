export type PurposeEventData = {
  event_name: string;
  id?: string;
  state?: string | number;
  versionId?: string;
};

export type AgreementEventData = {
  event_name: string;
  id?: string;
  state?: string | number;
};

export type AuthorizationEventData = {
  event_name: string;
  id?: string;
  kid?: string;
  user_id?: string;
};

export type CatalogEventData = {
  event_name: string;
  id?: string;
  descriptor_id?: string;
  state?: string | number;
};

export type DelegationEventData = {
  event_name: string;
  id?: string;
  state?: string | number;
};

export type StoreData =
  | PurposeEventData
  | AgreementEventData
  | AuthorizationEventData
  | CatalogEventData
  | DelegationEventData;
