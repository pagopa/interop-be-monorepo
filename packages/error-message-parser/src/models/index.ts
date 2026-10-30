export type ErrorMessage = {
  readonly process: string;
  readonly error: string;
  readonly errorCode: string | null;
  readonly bffEndpoint: string;
  readonly copy: {
    readonly it: string;
    readonly en: string;
  };
};
