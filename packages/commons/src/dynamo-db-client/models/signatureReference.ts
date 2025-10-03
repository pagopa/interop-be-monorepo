export interface SignatureReference {
  safeStorageId: string;
  fileKind: string;
  fileName: string;
  correlationId: string;
  creationTimestamp?: number;
}
