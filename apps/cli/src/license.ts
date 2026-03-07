import { createHmac } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ─── Secret ──────────────────────────────────────────────────────────────────
// Set your secret via the NODEHEXA_LICENSE_SECRET environment variable.
// On your key-generation server, export NODEHEXA_LICENSE_SECRET=<your-secret>
// In the published binary, this env var is read at runtime from your build env.
// IMPORTANT: never hard-code the real value here — inject it at build time.
const SIGNING_SECRET = process.env["NODEHEXA_LICENSE_SECRET"] ?? "";

// ─── Storage ─────────────────────────────────────────────────────────────────
const CONFIG_DIR = join(homedir(), ".config", "node-hexa");
const LICENSE_FILE = join(CONFIG_DIR, "license");

// ─── Key format ──────────────────────────────────────────────────────────────
// A license key encodes: email + expiry date, signed with HMAC-SHA256.
// Format: NODEHEXA-<BASE64(email:YYYY-MM-DD)>-<HMAC_HEX_FIRST_16_CHARS>
// You generate keys with generateLicenseKey() on your server or locally.

export function generateLicenseKey(email: string, expiresAt: string): string {
  const payload = `${email}:${expiresAt}`;
  const encoded = Buffer.from(payload).toString("base64url");
  const sig = createHmac("sha256", SIGNING_SECRET).update(payload).digest("hex").slice(0, 16);
  return `NODEHEXA-${encoded}-${sig}`;
}

function parseLicenseKey(key: string): { email: string; expiresAt: string } | null {
  const parts = key.split("-");
  if (parts.length < 3 || parts[0] !== "NODEHEXA") return null;

  const sig = parts.at(-1);
  if (!sig) return null;
  const encoded = parts.slice(1, -1).join("-");

  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expectedSig = createHmac("sha256", SIGNING_SECRET).update(payload).digest("hex").slice(0, 16);
  if (sig !== expectedSig) return null;

  const colonIdx = payload.indexOf(":");
  if (colonIdx === -1) return null;

  return {
    email: payload.slice(0, colonIdx),
    expiresAt: payload.slice(colonIdx + 1),
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function activateLicense(key: string): void {
  const parsed = parseLicenseKey(key.trim());
  if (!parsed) {
    console.error("✗ Invalid license key.");
    process.exit(1);
  }

  const today = new Date().toISOString().slice(0, 10);
  if (parsed.expiresAt !== "lifetime" && parsed.expiresAt < today) {
    console.error(`✗ This license key expired on ${parsed.expiresAt}.`);
    process.exit(1);
  }

  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(LICENSE_FILE, key.trim(), "utf8");
  console.log(`✓ License activated for ${parsed.email} (valid until: ${parsed.expiresAt})`);
}

export function checkLicense(): void {
  if (!existsSync(LICENSE_FILE)) {
    console.error(
      "✗ No license found. Purchase a license at https://your-website.com and run:\n" +
      "  node-hexa activate <your-license-key>",
    );
    process.exit(1);
  }

  const key = readFileSync(LICENSE_FILE, "utf8").trim();
  const parsed = parseLicenseKey(key);

  if (!parsed) {
    console.error(
      "✗ License file is corrupted. Re-activate with:\n" +
      "  node-hexa activate <your-license-key>",
    );
    process.exit(1);
  }

  const today = new Date().toISOString().slice(0, 10);
  if (parsed.expiresAt !== "lifetime" && parsed.expiresAt < today) {
    console.error(
      `✗ Your license expired on ${parsed.expiresAt}. Renew at https://your-website.com`,
    );
    process.exit(1);
  }
}
