import { Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { hashPassword, comparePassword, hashToken } from "../utils/hash";
import { signAccessToken, signRefreshToken, verifyToken } from "../utils/jwt";

export class AuthService {
  static async register(email: string, password: string, ipAddress?: string, userAgent?: string) {
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      throw new Error("Email already registered");
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash,
        role: Role.USER,
        groups: {
          create: {
            name: "General",
            color: "#2563EB",
          },
        },
      },
    });

    const payload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // Save refresh token session
    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      accessToken,
      refreshToken,
    };
  }

  static async login(email: string, password: string, ipAddress?: string, userAgent?: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      throw new Error("Invalid email or password");
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      throw new Error("Invalid email or password");
    }

    if (user.isBanned) {
      await prisma.session.updateMany({
        where: { userId: user.id },
        data: { isRevoked: true },
      });

      const reason = user.banReason
        ? `Your account has been suspended: ${user.banReason}`
        : "Your account has been suspended by an administrator.";
      const error: any = new Error(reason);
      error.statusCode = 403;
      throw error;
    }

    const payload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // Store Session
    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      accessToken,
      refreshToken,
    };
  }

  static async rotateRefreshToken(oldRefreshToken: string, ipAddress?: string, userAgent?: string) {
    const decoded = verifyToken(oldRefreshToken);
    if (!decoded) {
      throw new Error("Invalid or expired refresh token");
    }

    const oldTokenHash = hashToken(oldRefreshToken);
    const session = await prisma.session.findUnique({
      where: { tokenHash: oldTokenHash },
    });

    // Reuse detection: If session doesn't exist or is already revoked
    if (!session || session.isRevoked || session.expiresAt < new Date()) {
      // Invalidate all sessions for this user for security
      if (session) {
        await prisma.session.updateMany({
          where: { userId: session.userId },
          data: { isRevoked: true },
        });
      }
      throw new Error("Session invalid or compromised. Please login again.");
    }

    // Revoke old session
    await prisma.session.update({
      where: { id: session.id },
      data: { isRevoked: true },
    });

    // Check user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });
    if (!user) {
      throw new Error("User no longer exists");
    }

    if (user.isBanned) {
      await prisma.session.updateMany({
        where: { userId: user.id },
        data: { isRevoked: true },
      });

      const reason = user.banReason
        ? `Your account has been suspended: ${user.banReason}`
        : "Your account has been suspended by an administrator.";
      const error: any = new Error(reason);
      error.statusCode = 403;
      throw error;
    }

    // Issue new pair
    const payload = { userId: user.id, email: user.email, role: user.role };
    const newAccessToken = signAccessToken(payload);
    const newRefreshToken = signRefreshToken(payload);

    // Save new session
    const newTokenHash = hashToken(newRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: newTokenHash,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  static async logout(refreshToken?: string) {
    if (!refreshToken) return;
    const tokenHash = hashToken(refreshToken);
    await prisma.session.updateMany({
      where: { tokenHash },
      data: { isRevoked: true },
    });
  }

  static async getUserProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  }
}
