#!/usr/bin/env node
// Usage:
//   export NODEHEXA_LICENSE_SECRET=ton_secret
//   node scripts/generate-license.mjs <email> <expiry>
//   node scripts/generate-license.mjs alice@acme.com lifetime
//   node scripts/generate-license.mjs alice@acme.com 2027-12-31

import { createHmac } from "node:crypto";

const secret = process.env["NODEHEXA_LICENSE_SECRET"];
const [email, expiry] = process.argv.slice(2);

if (!secret) die("NODEHEXA_LICENSE_SECRET non défini.\n  export NODEHEXA_LICENSE_SECRET=ton_secret");
if (!email || !expiry) die("Usage: generate-license.mjs <email> <expiry>\n  expiry = lifetime | YYYY-MM-DD");
if (expiry !== "lifetime" && !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) die("Date invalide, utilise YYYY-MM-DD ou lifetime");

function die(msg) { console.error(`✗ ${msg}`); process.exit(1); }

const payload = `${email}:${expiry}`;
const encoded = Buffer.from(payload).toString("base64url");
const sig     = createHmac("sha256", secret).update(payload).digest("hex").slice(0, 16);
const key     = `NODEHEXA-${encoded}-${sig}`;

console.log(`\n✓ ${key}\n`);
console.log(`  email  → ${email}`);
console.log(`  expiry → ${expiry}`);
console.log(`\n  node-hexa activate ${key}\n`);
