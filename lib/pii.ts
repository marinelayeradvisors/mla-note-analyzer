const PII_HEADER_PATTERNS: RegExp[] = [
  /account/i,
  /ssn/i,
  /social/i,
  /dob/i,
  /birth/i,
  /address/i,
  /email/i,
  /phone/i,
  /name/i,
  /client/i,
  /household/i,
];

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/;
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/;

export function headerLooksLikePII(header: string): boolean {
  return PII_HEADER_PATTERNS.some((re) => re.test(header));
}

export function valueLooksLikePII(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  const s = String(v);
  if (!s) return false;
  return EMAIL_RE.test(s) || PHONE_RE.test(s) || SSN_RE.test(s);
}
