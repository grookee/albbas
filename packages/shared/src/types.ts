import type { AllowedDomain } from './constants.js';

export type UserRole = 'USER' | 'ADMIN';

export interface PublicUser {
  id: string;
  email: string;
  role: UserRole;
  domain: AllowedDomain | null;
  subdomain: string | null;
  createdAt: string;
}

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
