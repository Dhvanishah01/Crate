// Server only: the owner unlocks editing on /owner with OWNER_PASSCODE (a Vercel env var).
// The cookie holds an HMAC of the passcode, so changing the passcode signs every browser out.
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const OWNER_COOKIE = "crate_owner";

const hmac = (key: string, msg: string) => createHmac("sha256", key).update(msg).digest();

export function ownerToken() {
  const p = process.env.OWNER_PASSCODE;
  return p ? hmac(p, "crate-owner-v1").toString("hex") : null;
}

export function passcodeMatches(input: string) {
  const p = process.env.OWNER_PASSCODE;
  // hash both sides so the comparison is constant-time whatever the lengths
  return !!p && timingSafeEqual(hmac("cmp", input), hmac("cmp", p));
}

export async function isOwner() {
  const token = ownerToken();
  const cookie = (await cookies()).get(OWNER_COOKIE)?.value;
  return !!token && !!cookie && timingSafeEqual(hmac("cmp", cookie), hmac("cmp", token));
}
