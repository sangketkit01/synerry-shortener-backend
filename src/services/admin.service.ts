import { prisma } from "../config/prisma";

export class AdminService {
  /**
   * Retrieves all URLs across all users and guests with moderation details and filters.
   */
  static async getAllUrls(query: {
    search?: string;
    status?: "ALL" | "BANNED" | "ACTIVE" | "INACTIVE" | "DELETED";
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 15));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.status === "BANNED") {
      where.isBanned = true;
    } else if (query.status === "DELETED") {
      where.deletedAt = { not: null };
    } else if (query.status === "ACTIVE") {
      where.isBanned = false;
      where.deletedAt = null;
      where.isActive = true;
    } else if (query.status === "INACTIVE") {
      where.deletedAt = null;
      where.isActive = false;
    }

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { originalUrl: { contains: search, mode: "insensitive" } },
        { shortCode: { contains: search, mode: "insensitive" } },
        { customAlias: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [urls, total, totalBanned] = await Promise.all([
      prisma.url.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, email: true, role: true },
          },
          bannedBy: {
            select: { id: true, email: true },
          },
        },
      }),
      prisma.url.count({ where }),
      prisma.url.count({ where: { isBanned: true } }),
    ]);

    return {
      urls,
      stats: {
        totalUrls: total,
        totalBanned,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Bans a URL with a mandatory reason.
   */
  static async banUrl(urlId: string, adminId: string, reason: string) {
    const trimmedReason = reason.trim();
    if (!trimmedReason || trimmedReason.length < 3) {
      throw new Error("A valid reason of at least 3 characters is required to ban a URL.");
    }

    const existing = await prisma.url.findUnique({
      where: { id: urlId },
    });

    if (!existing) {
      throw new Error("URL not found");
    }

    return prisma.url.update({
      where: { id: urlId },
      data: {
        isBanned: true,
        banReason: trimmedReason,
        bannedAt: new Date(),
        bannedById: adminId,
      },
      include: {
        user: { select: { id: true, email: true } },
        bannedBy: { select: { id: true, email: true } },
      },
    });
  }

  /**
   * Unbans a URL, restoring normal access.
   */
  static async unbanUrl(urlId: string) {
    const existing = await prisma.url.findUnique({
      where: { id: urlId },
    });

    if (!existing) {
      throw new Error("URL not found");
    }

    return prisma.url.update({
      where: { id: urlId },
      data: {
        isBanned: false,
        banReason: null,
        bannedAt: null,
        bannedById: null,
      },
      include: {
        user: { select: { id: true, email: true } },
      },
    });
  }

  /**
   * Permanently deletes a URL as an admin.
   */
  static async deleteUrl(urlId: string) {
    const existing = await prisma.url.findUnique({
      where: { id: urlId },
    });

    if (!existing) {
      throw new Error("URL not found");
    }

    return prisma.url.delete({
      where: { id: urlId },
    });
  }

  /**
   * System overview statistics.
   */
  static async getOverview() {
    const [totalUsers, totalUrls, totalClicks, totalBanned] = await Promise.all([
      prisma.user.count(),
      prisma.url.count(),
      prisma.url.aggregate({ _sum: { clickCount: true } }),
      prisma.url.count({ where: { isBanned: true } }),
    ]);

    return {
      totalUsers,
      totalUrls,
      totalClicks: totalClicks._sum.clickCount || 0,
      totalBanned,
    };
  }

  /**
   * Lists all registered user accounts with suspension status.
   */
  static async getUsers() {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        isBanned: true,
        banReason: true,
        bannedAt: true,
        createdAt: true,
        _count: {
          select: { urls: true, groups: true },
        },
      },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      isBanned: u.isBanned,
      banReason: u.banReason,
      bannedAt: u.bannedAt,
      createdAt: u.createdAt,
      urlsCount: u._count.urls,
      groupsCount: u._count.groups,
    }));
  }

  /**
   * Suspends a user account and revokes active sessions.
   */
  static async banUser(userId: string, adminId: string, reason: string) {
    const trimmedReason = reason.trim();
    if (!trimmedReason || trimmedReason.length < 3) {
      throw new Error("A valid reason of at least 3 characters is required to suspend a user.");
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error("User not found");
    }
    if (user.role === "ADMIN") {
      throw new Error("Cannot suspend an administrator account.");
    }

    // Revoke all active sessions for this user
    await prisma.session.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });

    return prisma.user.update({
      where: { id: userId },
      data: {
        isBanned: true,
        banReason: trimmedReason,
        bannedAt: new Date(),
      },
    });
  }

  /**
   * Lifts suspension from a user account.
   */
  static async unbanUser(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error("User not found");
    }

    return prisma.user.update({
      where: { id: userId },
      data: {
        isBanned: false,
        banReason: null,
        bannedAt: null,
      },
    });
  }
}
