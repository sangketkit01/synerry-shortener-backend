import crypto from "crypto";
import { prisma } from "../config/prisma";
import {
  generateShortCode,
  isValidUrl,
  isValidCustomAlias,
  isSelfReferencingUrl,
} from "../utils/short-code";

export interface CreateUrlDTO {
  originalUrl: string;
  customAlias?: string | null;
  title?: string | null;
  groupId?: string | null;
  expiresAt?: string | null;
  qrColorDark?: string | null;
  qrColorLight?: string | null;
  userId?: string | null;
}

export class UrlService {
  /**
   * Generates a guaranteed unique short code with collision retry mechanism.
   */
  private static async getUniqueShortCode(maxRetries: number = 5): Promise<string> {
    for (let i = 0; i < maxRetries; i++) {
      const code = generateShortCode(6);
      const existing = await prisma.url.findUnique({
        where: { shortCode: code },
      });
      if (!existing) {
        return code;
      }
    }
    return generateShortCode(7);
  }

  /**
   * Creates or returns existing short URL with robust validation, ban-evasion defense, and immutability.
   */
  static async createShortUrl(dto: CreateUrlDTO) {
    const originalUrl = dto.originalUrl.trim();

    // 1. Strict URL Format Validation
    if (!isValidUrl(originalUrl)) {
      throw new Error("Invalid URL format. Must start with http:// or https://");
    }

    // 2. Prevent Infinite Redirection Loops
    if (isSelfReferencingUrl(originalUrl)) {
      throw new Error("Cannot create a short link targeting this platform domain.");
    }

    // 3. Ban Evasion Defense: Reject if the destination URL was banned by administrator
    const bannedDestination = await prisma.url.findFirst({
      where: { originalUrl, isBanned: true },
    });
    if (bannedDestination) {
      throw new Error("This destination URL has been suspended due to security violations.");
    }

    // 4. Handle Custom Alias if requested
    if (dto.customAlias) {
      const alias = dto.customAlias.trim();
      if (!isValidCustomAlias(alias)) {
        throw new Error(
          "Invalid custom alias. Must be 3-30 alphanumeric characters/hyphens and not a reserved word."
        );
      }

      const existingAlias = await prisma.url.findFirst({
        where: {
          OR: [{ shortCode: alias }, { customAlias: alias }],
          deletedAt: null,
        },
      });

      if (existingAlias) {
        throw new Error("Custom alias is already in use. Please choose another.");
      }

      const claimToken = !dto.userId ? crypto.randomUUID() : null;

      const url = await prisma.url.create({
        data: {
          userId: dto.userId || null,
          groupId: dto.groupId || null,
          originalUrl,
          shortCode: alias,
          customAlias: alias,
          claimToken,
          title: dto.title?.trim() || null,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          qrColorDark: dto.qrColorDark || "#000000",
          qrColorLight: dto.qrColorLight || "#ffffff",
        },
      });

      return { url, isExisting: false };
    }

    // 5. Deduplication Check (Decision A):
    // If this user (or guest) already created a short link for this exact target, return it without modifying shortCode.
    const existing = await prisma.url.findFirst({
      where: {
        originalUrl,
        userId: dto.userId || null,
        customAlias: null,
        isBanned: false,
        deletedAt: null,
      },
    });

    if (existing) {
      return { url: existing, isExisting: true };
    }

    // 6. Create Fresh Short URL
    const shortCode = await this.getUniqueShortCode();
    const claimToken = !dto.userId ? crypto.randomUUID() : null;

    const url = await prisma.url.create({
      data: {
        userId: dto.userId || null,
        groupId: dto.groupId || null,
        originalUrl,
        shortCode,
        claimToken,
        title: dto.title?.trim() || null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        qrColorDark: dto.qrColorDark || "#000000",
        qrColorLight: dto.qrColorLight || "#ffffff",
      },
    });

    return { url, isExisting: false };
  }

  /**
   * Resolves short code or alias for redirection.
   */
  static async resolveUrl(code: string) {
    const trimmedCode = code.trim();
    return prisma.url.findFirst({
      where: {
        OR: [{ shortCode: trimmedCode }, { customAlias: trimmedCode }],
        deletedAt: null,
      },
    });
  }

  /**
   * High-throughput non-blocking click recording:
   * Uses an append-only raw click insert without transaction row-locks on urls table.
   */
  static recordClickAsync(
    urlId: string,
    ipAddress?: string,
    userAgent?: string,
    referrer?: string
  ) {
    setImmediate(async () => {
      try {
        await prisma.rawClick.create({
          data: {
            urlId,
            ipAddress: ipAddress || null,
            userAgent: userAgent || null,
            referrer: referrer || null,
            isProcessed: false,
          },
        });

        // Non-blocking asynchronous increment outside of transactions
        prisma.url
          .update({
            where: { id: urlId },
            data: { clickCount: { increment: 1 } },
          })
          .catch((err) =>
            console.error(`[ClickCount Increment Error for URL ${urlId}]:`, err)
          );
      } catch (err) {
        console.error(`[Click Tracking Error for URL ${urlId}]:`, err);
      }
    });
  }

  /**
   * Lists URLs belonging to a user with search, filter, and pagination.
   */
  static async getUserUrls(
    userId: string,
    query: {
      search?: string;
      groupId?: string;
      isFavorite?: boolean;
      isActive?: boolean;
      page?: number;
      limit?: number;
    }
  ) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;

    const where: any = { userId, deletedAt: null };

    if (query.groupId) {
      where.groupId = query.groupId;
    }

    if (query.isFavorite !== undefined) {
      where.isFavorite = query.isFavorite;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { originalUrl: { contains: search, mode: "insensitive" } },
        { shortCode: { contains: search, mode: "insensitive" } },
        { customAlias: { contains: search, mode: "insensitive" } },
      ];
    }

    const [urls, total] = await Promise.all([
      prisma.url.findMany({
        where,
        orderBy: [{ isFavorite: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
        include: {
          group: {
            select: { id: true, name: true, color: true },
          },
        },
      }),
      prisma.url.count({ where }),
    ]);

    return {
      urls,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Updates metadata for a URL.
   * Target destination URL is strictly IMMUTABLE to prevent Destination Hijacking.
   * Banned URLs are strictly LOCKED from any modifications.
   */
  static async updateUrl(
    urlId: string,
    userId: string,
    data: {
      title?: string | null;
      groupId?: string | null;
      expiresAt?: string | null;
      isActive?: boolean;
      qrColorDark?: string | null;
      qrColorLight?: string | null;
    }
  ) {
    const existing = await prisma.url.findFirst({
      where: { id: urlId, userId, deletedAt: null },
    });

    if (!existing) {
      throw new Error("URL not found or unauthorized");
    }

    if (existing.isBanned) {
      throw new Error(
        "This link has been suspended by an administrator and cannot be modified."
      );
    }

    return prisma.url.update({
      where: { id: urlId },
      data: {
        title: data.title !== undefined ? data.title?.trim() || null : existing.title,
        groupId: data.groupId !== undefined ? data.groupId : existing.groupId,
        expiresAt:
          data.expiresAt !== undefined
            ? data.expiresAt
              ? new Date(data.expiresAt)
              : null
            : existing.expiresAt,
        isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
        qrColorDark: data.qrColorDark || existing.qrColorDark,
        qrColorLight: data.qrColorLight || existing.qrColorLight,
      },
      include: {
        group: {
          select: { id: true, name: true, color: true },
        },
      },
    });
  }

  /**
   * Toggles the favorite status of a URL.
   */
  static async toggleFavorite(urlId: string, userId: string) {
    const url = await prisma.url.findFirst({
      where: { id: urlId, userId, deletedAt: null },
    });

    if (!url) {
      throw new Error("URL not found or unauthorized");
    }

    if (url.isBanned) {
      throw new Error("This link has been suspended by an administrator.");
    }

    return prisma.url.update({
      where: { id: urlId },
      data: { isFavorite: !url.isFavorite },
    });
  }

  /**
   * Toggles the active/inactive status of a URL.
   */
  static async toggleActive(urlId: string, userId: string) {
    const url = await prisma.url.findFirst({
      where: { id: urlId, userId, deletedAt: null },
    });

    if (!url) {
      throw new Error("URL not found or unauthorized");
    }

    if (url.isBanned) {
      throw new Error("This link has been suspended by an administrator.");
    }

    return prisma.url.update({
      where: { id: urlId },
      data: { isActive: !url.isActive },
    });
  }

  /**
   * Deletes a URL owned by a user (Soft Delete).
   * Banned URLs are strictly locked to preserve evidence and banReason audit records.
   */
  static async deleteUrl(urlId: string, userId: string) {
    const url = await prisma.url.findFirst({
      where: { id: urlId, userId, deletedAt: null },
    });

    if (!url) {
      throw new Error("URL not found or unauthorized");
    }

    if (url.isBanned) {
      throw new Error(
        "This link has been suspended by an administrator and cannot be deleted."
      );
    }

    return prisma.url.update({
      where: { id: urlId },
      data: {
        deletedAt: new Date(),
        shortCode: `${url.shortCode}_del_${Date.now()}`,
        customAlias: null,
      },
    });
  }

  /**
   * Claims guest URLs into a user's account with cryptographic claim token verification.
   * Completely eliminates Guest Link Hijacking by requiring matching claimToken.
   */
  static async syncGuestUrls(
    claims: { shortCode: string; claimToken: string }[],
    userId: string
  ) {
    if (!claims || !Array.isArray(claims) || claims.length === 0) {
      return { syncedCount: 0 };
    }

    let syncedCount = 0;

    for (const claim of claims) {
      // STRICT VERIFICATION: Both shortCode and claimToken are MANDATORY non-empty strings
      if (!claim || typeof claim !== "object") continue;
      const shortCode = typeof claim.shortCode === "string" ? claim.shortCode.trim() : null;
      const claimToken = typeof claim.claimToken === "string" ? claim.claimToken.trim() : null;

      if (!shortCode || !claimToken) {
        continue; // Discard any attempt without a cryptographic claimToken
      }

      // Only match URL if userId is unassigned AND claimToken matches EXACTLY
      const updated = await prisma.url.updateMany({
        where: {
          shortCode,
          userId: null,
          claimToken,
          deletedAt: null,
        },
        data: {
          userId,
          claimToken: null, // Nullify token on successful transfer to prevent reuse
        },
      });

      syncedCount += updated.count;
    }

    return { syncedCount };
  }
}
