// Client-side validation for CUR-related CloudFormation parameters.
//
// Patterns mirror the AllowedPattern values in
// backend/src/numio/onboarding/cfn_template.py for the parameters
// CurBucketName, CurPathPrefix, and CurReportName. Keep both sides in
// sync — the backend remains authoritative; this layer just blocks the
// user from generating a template the stack will reject at deploy time.

export const CFN_FIELD_KINDS = {
  bucket: {
    pattern: /^$|^[a-z0-9][a-z0-9.\-]{1,61}[a-z0-9]$/,
    error:
      "Must be 3–63 lowercase letters, numbers, dots, or hyphens, and cannot start or end with a hyphen or dot. Leave blank if you have not set up a CUR bucket.",
  },
  prefix: {
    pattern: /^[A-Za-z0-9._/-]{0,512}$/,
    error:
      "Only letters, numbers, dots, underscores, hyphens, and forward slashes are allowed.",
  },
  report: {
    pattern: /^[A-Za-z0-9_-]{0,128}$/,
    error: "Only letters, numbers, underscores, and hyphens are allowed.",
  },
};

export function validateCfnField(kind, value) {
  const v = CFN_FIELD_KINDS[kind];
  if (!v) return null;
  return v.pattern.test(value ?? "") ? null : v.error;
}
