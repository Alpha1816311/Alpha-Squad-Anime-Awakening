import { getAuth } from "@clerk/express";
import type { RequestHandler } from "express";

/**
 * Founder access is an explicit server-side allowlist of Clerk user IDs.
 * Leaving FOUNDER_USER_IDS unset denies access to every account.
 */
const founderUserIds = () =>
  (process.env.FOUNDER_USER_IDS ?? "")
    .split(",")
    .map((userId) => userId.trim())
    .filter(Boolean);

const requireFounder: RequestHandler = (req, res, next) => {
  const userId = getAuth(req).userId;

  if (!userId) {
    res.status(401).json({ error: "Sign in to access founder tools." });
    return;
  }

  if (!founderUserIds().includes(userId)) {
    res.status(403).json({ error: "Founder access is not configured for this account." });
    return;
  }

  next();
};

export default requireFounder;
