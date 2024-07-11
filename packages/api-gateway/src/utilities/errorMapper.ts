import { constants } from "http2";

const { HTTP_STATUS_INTERNAL_SERVER_ERROR } = constants;

export const emptyErrorMapper = (): number => HTTP_STATUS_INTERNAL_SERVER_ERROR;
