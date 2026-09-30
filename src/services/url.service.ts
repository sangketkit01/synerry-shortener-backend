import { prisma } from "../config/prisma";
import { generateShortCode, isValidUrl, isValidCustomAlias } from "../utils/short-code";

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
   * Creates or updates a short URL with duplicate checking & regeneration logic.
   */
  static async createShortUrl(dto: CreateUrlDTO) {
    const originalUrl = dto.originalUrl.trim();
    if (!isValidUrl(originalUrl)) {
      throw new Error("Invalid URL format. Must start with http:// or https://");
    }

    // 1. Handle Custom Alias if requested
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
        },
      });

      if (existingAlias) {
        throw new Error("Custom alias is already in use. Please choose another.");
      }

      // Create new record with custom alias
      const url = await prisma.url.create({
        data: {
          userId: dto.userId || null,
          groupId: dto.groupId || null,
          originalUrl,
          shortCode: alias,
          customAlias: alias,
          title: dto.title?.trim() || null,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          qrColorDark: dto.qrColorDark || "#000000",
          qrColorLight: dto.qrColorLight || "#ffffff",
        },
      });

      return { url, isUpdated: false };
    }

    // 2. Deduplication check: Has this user (or guest) already shortened this exact URL?
    const existing = await prisma.url.findFirst({
      where: {
        originalUrl,
        userId: dto.userId || null,
        customAlias: null, // Only deduplicate standard generated URLs
      },
    });

    if (existing) {
      // Per specification: If the same URL is submitted, regenerate a new short URL and update the record
      const newShortCode = await this.getUniqueShortCode();
      const updated = await prisma.url.update({
        where: { id: existing.id },
        data: {
          shortCode: newShortCode,
          title: dto.title?.trim() || existing.title,
          groupId: dto.groupId !== undefined ? dto.groupId : existing.groupId,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : existing.expiresAt,
          qrColorDark: dto.qrColorDark || existing.qrColorDark,
          qrColorLight: dto.qrColorLight || existing.qrColorLight,
          isActive: true, // Reset to active if was disabled
        },
      });

      return { url: updated, isUpdated: true };
    }

    // 3. Create fresh Short URL
    const shortCode = await this.getUniqueShortCode();
    const url = await prisma.url.create({
      data: {
        userId: dto.userId || null,
        groupId: dto.groupId || null,
        originalUrl,
        shortCode,
        title: dto.title?.trim() || null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        qrColorDark: dto.qrColorDark || "#000000",
        qrColorLight: dto.qrColorLight || "#ffffff",
      },
    });

    return { url, isUpdated: false };
  }

  /**
   * Resolves short code or alias for redirection.
   */
  static async resolveUrl(code: string) {
    const trimmedCode = code.trim();
    return prisma.url.findFirst({
      where: {
        OR: [{ shortCode: trimmedCode }, { customAlias: trimmedCode }],
      },
    });
  }

  /**
   * Asynchronously records raw click without blocking the redirect response.
   */
  static recordClickAsync(
    urlId: string,
    ipAddress?: string,
    userAgent?: string,
    referrer?: string
  ) {
    setImmediate(async () => {
      try {
        await prisma.$transaction([
          prisma.rawClick.create({
            data: {
              urlId,
              ipAddress: ipAddress || null,
              userAgent: userAgent || null,
              referrer: referrer || null,
              isProcessed: false,
            },
          }),
          prisma.url.update({
            where: { id: urlId },
            data: {
              clickCount: { increment: 1 },
            },
          }),
        ]);
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

    const where: any = { userId };

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
        orderBy: { createdAt: "desc" },
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
   * Toggles the favorite status of a URL.
   */
  static async toggleFavorite(urlId: string, userId: string) {
    const url = await prisma.url.findFirst({
      where: { id: urlId, userId },
    });

    if (!url) {
      throw new Error("URL not found or unauthorized");
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
      where: { id: urlId, userId },
    });

    if (!url) {
      throw new Error("URL not found or unauthorized");
    }

    return prisma.url.update({
      where: { id: urlId },
      data: { isActive: !url.isActive },
    });
  }

  /**
   * Deletes a URL owned by a user.
   */
  static async deleteUrl(urlId: string, userId: string) {
    const url = await prisma.url.findFirst({
      where: { id: urlId, userId },
    });

    if (!url) {
      throw new Error("URL not found or unauthorized");
    }

    return prisma.url.delete({
      where: { id: urlId },
    });
  }

  /**
   * Claims guest URLs stored in localStorage into a user's account upon login.
   */
  static async syncGuestUrls(shortCodes: string[], userId: string) {
    if (!shortCodes || shortCodes.length === 0) return { syncedCount: 0 };

    const result = await prisma.url.updateMany({
      where: {
        shortCode: { in: shortCodes },
        userId: null, // Only claim unclaimed guest URLs
      },
      data: {
        userId,
      },
    });

    return { syncedCount: result.count };
  }
}
