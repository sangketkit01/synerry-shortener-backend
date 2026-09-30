import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Role } from "@prisma/client";
import { env } from "../config/env";

export interface TokenPayload {
  userId: string;
  email: string;
  role: Role;
  jti?: string;
}

export function signAccessToken(payload: Omit<TokenPayload, "jti">): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: "15m",
  });
}

export function signRefreshToken(payload: Omit<TokenPayload, "jti">): string {
  return jwt.sign(
    {
      ...payload,
      jti: crypto.randomUUID(), // Guarantee unique token signature per rotation
    },
    env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  } catch (error) {
    return null;
  }
}
