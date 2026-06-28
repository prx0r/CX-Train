import { NextRequest } from 'next/server';

const DEFAULT_MANAGER_PROFILE_ID = 'manager-default-v1';

export function getCallumManagerProfile(request: NextRequest): string {
  const header = request.headers.get('x-manager-profile-id');
  if (header) return header;

  return DEFAULT_MANAGER_PROFILE_ID;
}

export function resolveManagerProfile(
  overrideFromBody: string | null | undefined,
): string {
  return overrideFromBody || DEFAULT_MANAGER_PROFILE_ID;
}
