export interface AppUser {
  id: number;
  fullName?: string;
  email?: string;
  isActive?: boolean;
  defaultOrganizationId?: number | null;
  roleCodes?: string[];
  permissions?: Array<{
    code: string;
    organizationId: number;
    orgUnitId: number | null;
  }>;
}

export interface AppRequest {
  body: any;
  params: Record<string, string>;
  query: Record<string, any>;
  headers: Record<string, string | string[] | undefined>;
  files?: any;
  user?: AppUser;
  organizationId?: number;
  organization?: any;
  originalUrl: string;
}

export interface AppResponse {
  status(code: number): AppResponse;
  json(body: unknown): AppResponse;
}

export type AppNext = (error?: unknown) => void;
