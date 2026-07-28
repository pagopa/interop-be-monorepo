import {
  DescriptorId,
  EServiceId,
  EServiceIdDescriptorId,
} from "pagopa-interop-models";

const SEPARATOR = "/";

export const formatEServiceIdDescriptorId = (
  eserviceId: EServiceId,
  descriptorId: DescriptorId
): EServiceIdDescriptorId =>
  EServiceIdDescriptorId.parse(`${eserviceId}${SEPARATOR}${descriptorId}`);

export const parseEServiceIdDescriptorId = (
  value: string
): { eserviceId: EServiceId; descriptorId: DescriptorId } => {
  const [eserviceId, descriptorId, ...rest] = value.split(SEPARATOR);
  if (!eserviceId || !descriptorId || rest.length > 0) {
    throw new Error(`Invalid scheduled notification entity_id: ${value}`);
  }
  return {
    eserviceId: EServiceId.parse(eserviceId),
    descriptorId: DescriptorId.parse(descriptorId),
  };
};

export const eServiceIdDescriptorIdPrefix = (eserviceId: EServiceId): string =>
  `${eserviceId}${SEPARATOR}`;

export const formatEServiceEntityId = (eserviceId: EServiceId): EServiceId =>
  eserviceId;

export const parseEServiceEntityId = (value: string): EServiceId => {
  if (value.includes(SEPARATOR)) {
    throw new Error(
      `Invalid scheduled notification entity_id for eservice scope: ${value}`
    );
  }
  return EServiceId.parse(value);
};
