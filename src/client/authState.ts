export type AuthPhase =
  | 'signed-out'
  | 'piv-loading'
  | 'piv-success'
  | 'sso-form'
  | 'sso-loading'
  | 'sso-success'
  | 'signed-in';

export interface AuthIdentity {
  name: string;
  division: string;
}

export const AUTH_IDENTITY: AuthIdentity = {
  name: 'Sarah Chen',
  division: 'ALFD'
};

export const AUTH_TIMINGS = {
  loadingMs: 1200,
  successMs: 700
} as const;
