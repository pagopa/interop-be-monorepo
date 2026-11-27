import { constants } from "http2";

export const detectionErrorMapper = (): number =>
  constants.HTTP_STATUS_INTERNAL_SERVER_ERROR;

export const invalidRequestBodyErrorMapper = (): number =>
  constants.HTTP_STATUS_BAD_REQUEST;
