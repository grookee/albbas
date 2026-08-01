export interface UploadUrlResponse {
  url: string;
  deleteUrl: string;
}

export interface SxcuConfig {
  Name: string;
  DestinationType: string;
  RequestMethod: string;
  RequestURL: string;
  Body: string;
  FileFormName: string;
  Headers: Record<string, string>;
  URL: string;
  DeletionURL: string;
  ErrorMessage: string;
}
