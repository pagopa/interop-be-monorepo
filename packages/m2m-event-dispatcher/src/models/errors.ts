import {
  DescriptorId,
  EServiceId,
  InternalError,
  PurposeId,
  PurposeVersionId,
  EServiceTemplateId,
  EServiceTemplateVersionId,
} from "pagopa-interop-models";

type M2MEventDispatcherErrorCode =
  | "descriptorNotFoundInEService"
  | "purposeEServiceNotFound"
  | "purposeVersionNotFoundInPurpose"
  | "eserviceTemplateVersionNotFoundInEServiceTemplate";

export class M2MEventDispatcherError extends InternalError<M2MEventDispatcherErrorCode> {
  constructor({
    code,
    detail,
  }: {
    code: M2MEventDispatcherErrorCode;
    detail: string;
  }) {
    super({ code, detail });
  }
}

export function descriptorNotFoundInEService(
  descriptorId: DescriptorId,
  eserviceId: EServiceId
): M2MEventDispatcherError {
  return new M2MEventDispatcherError({
    detail: `Descriptor ${descriptorId} not found in E-Service ${eserviceId}`,
    code: "descriptorNotFoundInEService",
  });
}

export function purposeEServiceNotFound(
  eserviceId: EServiceId,
  purposeId: PurposeId
): M2MEventDispatcherError {
  return new M2MEventDispatcherError({
    detail: `E-Service ${eserviceId} for Purpose ${purposeId} not found`,
    code: "purposeEServiceNotFound",
  });
}

export function purposeVersionNotFoundInPurpose(
  purposeVersionId: PurposeVersionId,
  purposeId: PurposeId
): M2MEventDispatcherError {
  return new M2MEventDispatcherError({
    detail: `Purpose Version ${purposeVersionId} not found in Purpose ${purposeId}`,
    code: "purposeVersionNotFoundInPurpose",
  });
}

export function eserviceTemplateVersionNotFoundInEServiceTemplate(
  eserviceTemplateVersionId: EServiceTemplateVersionId,
  eserviceTemplateId: EServiceTemplateId
): M2MEventDispatcherError {
  return new M2MEventDispatcherError({
    detail: `EService Template Version ${eserviceTemplateVersionId} not found in E-Service Template ${eserviceTemplateId}`,
    code: "eserviceTemplateVersionNotFoundInEServiceTemplate",
  });
}
