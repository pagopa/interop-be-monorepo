import { DescriptorId, EServiceId, unsafeBrandId } from "pagopa-interop-models";

const SEPARATOR = "/";

export const composeEntityId = (
  eserviceId: EServiceId,
  descriptorId: DescriptorId
): string => `${eserviceId}${SEPARATOR}${descriptorId}`;

export const parseEntityId = (
  entityId: string
): { eserviceId: EServiceId; descriptorId: DescriptorId } => {
  const [eserviceId, descriptorId, ...rest] = entityId.split(SEPARATOR);
  if (!eserviceId || !descriptorId || rest.length > 0) {
    throw new Error(`Invalid scheduled notification entity_id: ${entityId}`);
  }
  return {
    eserviceId: unsafeBrandId<EServiceId>(eserviceId),
    descriptorId: unsafeBrandId<DescriptorId>(descriptorId),
  };
};

export const eserviceEntityIdPrefix = (eserviceId: EServiceId): string =>
  `${eserviceId}${SEPARATOR}`;
