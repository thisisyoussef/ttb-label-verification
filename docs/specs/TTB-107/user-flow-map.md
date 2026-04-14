# User Flow Map

## Entry and sign-in branches

### Happy path: PIV

1. Fresh load opens on Screen 0.
2. Reviewer clicks `Sign in with PIV / CAC Card`.
3. UI enters `piv-loading`.
4. Timer advances to `piv-success`.
5. Timer advances to `signed-in`.
6. Existing workstation shell renders with `Sarah Chen · ALFD` and `Sign out`.

### Happy path: Treasury SSO

1. Fresh load opens on Screen 0.
2. Reviewer clicks `Sign in with Treasury SSO`.
3. UI enters `sso-form` and focuses `User ID`.
4. Reviewer types any value and submits.
5. UI enters `sso-loading`.
6. Timer advances to `sso-success`.
7. Timer advances to `signed-in`.

## Alternate and recovery branches

### Back

1. Reviewer enters `sso-form`.
2. Reviewer clicks `Back`.
3. UI returns to `signed-out`.
4. If the reviewer re-enters SSO in the same tab session, the typed `User ID` remains present.

### Disclosure toggle

1. Reviewer is on Screen 0.
2. Reviewer expands `What would appear here`.
3. Informational banner copy appears.
4. Reviewer collapses it again.

### Sign-out cancel

1. Reviewer is signed in.
2. Reviewer clicks `Sign out`.
3. Inline confirmation appears in the header.
4. Reviewer clicks `Cancel`.
5. Confirmation closes and signed-in workstation remains unchanged.

### Sign-out confirm

1. Reviewer is signed in from any workstation state.
2. Reviewer clicks `Sign out`.
3. Inline confirmation appears.
4. Reviewer confirms sign-out.
5. Auth phase resets to `signed-out`.
6. Single-review, batch, preview, and guided-tour state reset to their clean defaults.
7. Screen 0 renders again.

### Sign-out timeout

1. Reviewer opens the sign-out confirmation.
2. Reviewer takes no action.
3. Reviewer stays signed in unless they confirm sign-out.
4. Separate inactivity handling now uses a timeout-warning modal instead of header countdown behavior.

## Disabled or bounded states

- Screen 0 has no partial-auth shell and no footer navigation.
- SSO submit is always available because every entered value is valid in the mock flow.
- The auth shell never reveals the workstation until `authPhase === 'signed-in'`.

## Failure and negative branches

- There is no real credential failure state in scope.
- There is no network retry branch because auth is fully client-local.
- The key negative branch is persistence: reload must drop back to Screen 0 and no auth-specific durable state may exist.
