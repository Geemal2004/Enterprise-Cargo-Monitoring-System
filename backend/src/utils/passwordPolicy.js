const { AppError } = require("./appError");

const PASSWORD_POLICY = Object.freeze({
  minLength: 12,
  requireLowercase: true,
  requireUppercase: true,
  requireNumber: true,
  requireSymbol: true,
});

function validatePassword(password) {
  const failures = [];

  if (typeof password !== "string" || password.length === 0) {
    failures.push("Password is required.");
    return failures;
  }

  if (password.length < PASSWORD_POLICY.minLength) {
    failures.push(`Password must be at least ${PASSWORD_POLICY.minLength} characters.`);
  }

  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
    failures.push("Password must include at least one lowercase letter.");
  }

  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    failures.push("Password must include at least one uppercase letter.");
  }

  if (PASSWORD_POLICY.requireNumber && !/[0-9]/.test(password)) {
    failures.push("Password must include at least one number.");
  }

  if (PASSWORD_POLICY.requireSymbol && !/[^A-Za-z0-9]/.test(password)) {
    failures.push("Password must include at least one symbol.");
  }

  return failures;
}

function assertPasswordPolicy(password) {
  const failures = validatePassword(password);
  if (failures.length > 0) {
    throw new AppError(failures.join(" "), 400, {
      code: "PASSWORD_POLICY_VIOLATION",
      policy: PASSWORD_POLICY,
      failures,
    });
  }
}

module.exports = {
  PASSWORD_POLICY,
  validatePassword,
  assertPasswordPolicy,
};
