import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { prisma } from "../config/prisma";

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: "USER" | "ADMIN";
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ success: false, message: "Unauthorized: Missing token" });
    return;
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token as string, env.JWT_SECRET) as AuthenticatedUser;

    // Check if user is suspended in the database
    const userRecord = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { isBanned: true, banReason: true },
    });

    if (!userRecord || userRecord.isBanned) {
      res.status(403).json({
        success: false,
        message: userRecord?.banReason
          ? `Your account has been suspended: ${userRecord.banReason}`
          : "Your account has been suspended by an administrator.",
      });
      return;
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: "Unauthorized: Invalid or expired token" });
  }
}
