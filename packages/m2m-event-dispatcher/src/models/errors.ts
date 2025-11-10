import {
  DescriptorId,
  EServiceId,
  EServiceTemplateId,
  EServiceTemplateVersionId,
  InternalError,
} from "pagopa-interop-models";

type M2MEventDispatcherErrorCode =
  | "descriptorNotFoundInEService"
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

export function eserviceTemplateVersionNotFoundInEServiceTemplate(
  eserviceTemplateVersionId: EServiceTemplateVersionId,
  eserviceTemplateId: EServiceTemplateId
): M2MEventDispatcherError {
  return new M2MEventDispatcherError({
    detail: `EService Template Version ${eserviceTemplateVersionId} not found in E-Service Template ${eserviceTemplateId}`,
    code: "eserviceTemplateVersionNotFoundInEServiceTemplate",
  });
}
