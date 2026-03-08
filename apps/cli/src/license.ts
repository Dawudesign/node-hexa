// License system — currently disabled (free/MIT release).
// To re-enable paid licensing, restore the full implementation from git history
// and set NODEHEXA_LICENSE_SECRET at build time.

export function checkLicense(): void {
  // License check disabled — free/MIT release.
}

export function activateLicense(_key: string): void {
  console.log("✓ This version is free — no license activation required.");
}
