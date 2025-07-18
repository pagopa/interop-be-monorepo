export interface FileCreationRequest {
  contentType: string;
  documentType: string;
  status: string;
  checksumValue?: string;
}

export interface FileCreationResponse {
  uploadMethod: "PUT" | "POST";
  uploadUrl: string;
  secret: string;
  key: string;
}

export interface FileDownloadResponse {
  key: string;
  versionId: string;
  contentType: string;
  contentLength: number;
  checksum: string;
  documentType: string;
  documentStatus: string;
  retentionUntil: string;
  download?: {
    url?: string;
    retryAfter?: number;
  };
}

export interface SafeStorageApiClient {
  createFile: (request: FileCreationRequest) => Promise<FileCreationResponse>;
  uploadFileContent: (
    uploadUrl: string,
    fileContent: Buffer,
    contentType: string,
    secret: string,
    checksumValue: string
  ) => Promise<void>;
  getFile: (
    fileKey: string,
    metadataOnly?: boolean
  ) => Promise<FileDownloadResponse>;
  downloadFileContent: (downloadUrl: string) => Promise<Buffer>;
}
