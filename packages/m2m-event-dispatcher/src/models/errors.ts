import { DescriptorId, EServiceId, InternalError } from "pagopa-interop-models";

type M2MEventDispatcherErrorCode = "descriptorNotFoundInEService";

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
