export const PASSWORD_POLICY = {
  minLength: 12,
  maxCharacters: 72,
  maxUtf8Bytes: 72,
  checks: [
    {
      label: "One lowercase letter",
      message: "Password must include a lowercase letter",
      pattern: /[a-z]/,
    },
    {
      label: "One uppercase letter",
      message: "Password must include an uppercase letter",
      pattern: /[A-Z]/,
    },
    {
      label: "One number",
      message: "Password must include a number",
      pattern: /[0-9]/,
    },
    {
      label: "One symbol",
      message: "Password must include a symbol",
      pattern: /[^A-Za-z0-9]/,
    },
  ],
} as const;

export const PASSWORD_RULES = [
  `At least ${PASSWORD_POLICY.minLength} characters`,
  `At most ${PASSWORD_POLICY.maxUtf8Bytes} UTF-8 bytes`,
  ...PASSWORD_POLICY.checks.map((check) => check.label),
] as const;
