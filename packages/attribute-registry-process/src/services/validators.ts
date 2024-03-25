import { AuthData } from "pagopa-interop-commons";
import { match } from "ts-pattern";
import { originNotCompliant } from "../model/domain/errors.js";

export function assertProducerAllowedOrigins(authData: AuthData): void {
  match(authData)
    .with(
      { tokenType: "empty" },
      { tokenType: "internal" },
      { tokenType: "m2m" },
      () => {
        throw originNotCompliant("");
      }
    )
    .with({ tokenType: "ui" }, (d) => {
      if (d.externalId.origin !== "IPA") {
        throw originNotCompliant("IPA");
      }
    })
    .exhaustive();
}
