/* eslint-disable sonarjs/no-identical-functions */
import { CommonErrorCodes } from "pagopa-interop-models";
import { ErrorCodes as LocalErrorCodes } from "../model/domain/errors.js";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ErrorCodes = LocalErrorCodes | CommonErrorCodes;
