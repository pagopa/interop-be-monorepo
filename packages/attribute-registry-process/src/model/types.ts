import { Problem } from "pagopa-interop-models";

export type ApiInternalServerError = Problem & {
  status: 500;
};
