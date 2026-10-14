import { Prisma } from '@prisma/client';

export const SLA_ESCALATION_POLICY_KEY = 'slaEscalation';
export const SLA_ESCALATION_PERMISSION_MATCH_MODES = ['any', 'all'] as const;
export type SlaEscalationPermissionMatchMode = typeof SLA_ESCALATION_PERMISSION_MATCH_MODES[number];

export interface SlaEscalationPolicy {
  enabled: boolean;
  permissionCodes: string[];
  matchMode: SlaEscalationPermissionMatchMode;
}

export type SlaEscalationPolicyParseResult =
  | { kind: 'missing' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'valid'; policy: SlaEscalationPolicy };

export const parseSlaEscalationPolicy = (value: unknown): SlaEscalationPolicyParseResult => {
  if (value === undefined || value === null) return { kind: 'missing' };
  if (typeof value !== 'object' || Array.isArray(value)) {
    return { kind: 'invalid', reason: 'policy must be an object' };
  }

  const policy = value as Record<string, unknown>;
  if (typeof policy.enabled !== 'boolean') {
    return { kind: 'invalid', reason: 'enabled must be a boolean' };
  }
  if (!Array.isArray(policy.permissionCodes) || policy.permissionCodes.length === 0) {
    return { kind: 'invalid', reason: 'permissionCodes must be a non-empty array' };
  }
  if (policy.permissionCodes.some((code) => typeof code !== 'string' || !/^[a-z][a-z0-9_.-]*$/.test(code))) {
    return { kind: 'invalid', reason: 'permissionCodes contains an invalid permission code' };
  }

  const permissionCodes = [...new Set(policy.permissionCodes as string[])];
  if (permissionCodes.length !== policy.permissionCodes.length) {
    return { kind: 'invalid', reason: 'permissionCodes must not contain duplicates' };
  }

  if (!SLA_ESCALATION_PERMISSION_MATCH_MODES.includes(policy.matchMode as SlaEscalationPermissionMatchMode)) {
    return { kind: 'invalid', reason: 'matchMode must be any or all' };
  }

  return {
    kind: 'valid',
    policy: {
      enabled: policy.enabled,
      permissionCodes,
      matchMode: policy.matchMode as SlaEscalationPermissionMatchMode,
    },
  };
};

export const mergeNotificationSettings = (
  current: unknown,
  incoming: Prisma.InputJsonValue
): Record<string, Prisma.InputJsonValue> => {
  const currentSettings = current && typeof current === 'object' && !Array.isArray(current)
    ? { ...(current as Record<string, Prisma.InputJsonValue>) }
    : {};
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return currentSettings;

  const incomingSettings = incoming as Record<string, Prisma.InputJsonValue | null>;
  const merged = { ...currentSettings };
  for (const [key, value] of Object.entries(incomingSettings)) {
    if (key === SLA_ESCALATION_POLICY_KEY && value === null) delete merged[key];
    else if (value !== null) merged[key] = value;
  }
  return merged;
};
