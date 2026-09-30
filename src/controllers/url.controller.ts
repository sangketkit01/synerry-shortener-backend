import { Request, Response } from "express";
import { z } from "zod";
import { UrlService } from "../services/url.service";
import { env } from "../config/env";

const createUrlSchema = z.object({
  originalUrl: z.string().url("A valid URL is required"),
  customAlias: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  groupId: z.string().uuid().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  qrColorDark: z.string().optional(),
  qrColorLight: z.string().optional(),
});

export class UrlController {
  /**
   * Handles Short URL creation for both Guest and Authenticated users.
   */
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const parsed = createUrlSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: parsed.error.issues[0]?.message || "Validation error",
        });
        return;
      }

      const userId = req.user?.userId || null;
      const result = await UrlService.createShortUrl({
        originalUrl: parsed.data.originalUrl,
        customAlias: parsed.data.customAlias,
        title: parsed.data.title,
        groupId: parsed.data.groupId,
        expiresAt: parsed.data.expiresAt,
        qrColorDark: parsed.data.qrColorDark,
        qrColorLight: parsed.data.qrColorLight,
        userId,
      });

      const shortUrl = `${env.FRONTEND_URL}/s/${result.url.shortCode}`;

      res.status(201).json({
        success: true,
        message: result.isExisting
          ? "Existing Short URL retrieved"
          : "Short URL created successfully",
        data: {
          url: result.url,
          shortUrl,
          isExisting: result.isExisting,
          claimToken: (result.url as any).claimToken,
        },
      });
    } catch (error: any) {
      const status = error.message?.includes("suspended") ? 403 : 400;
      res.status(status).json({
        success: false,
        message: error.message || "Failed to create short URL",
      });
    }
  }

  /**
   * High-speed 302 Redirection with status verification (Banned, Disabled, Expired).
   */
  static async redirect(req: Request, res: Response): Promise<void> {
    const rawCode = req.params.shortCode;
    const shortCode = Array.isArray(rawCode) ? rawCode[0] : rawCode;

    if (!shortCode) {
      res.status(400).send("Bad request");
      return;
    }

    try {
      const url = await UrlService.resolveUrl(shortCode);

      if (!url) {
        res.redirect(302, `${env.FRONTEND_URL}/status/not-found?code=${encodeURIComponent(shortCode)}`);
        return;
      }

      // 1. Check if Banned by Administrator
      if (url.isBanned) {
        const reason = encodeURIComponent(url.banReason || "Security terms violation");
        res.redirect(302, `${env.FRONTEND_URL}/status/banned?code=${encodeURIComponent(shortCode)}&reason=${reason}`);
        return;
      }

      // 2. Check if Inactive (Disabled by user)
      if (!url.isActive) {
        res.redirect(302, `${env.FRONTEND_URL}/status/disabled?code=${encodeURIComponent(shortCode)}`);
        return;
      }

      // 3. Check if Expired
      if (url.expiresAt && url.expiresAt < new Date()) {
        res.redirect(302, `${env.FRONTEND_URL}/status/expired?code=${encodeURIComponent(shortCode)}`);
        return;
      }

      // 4. Valid Link -> Record click asynchronously & redirect immediately
      const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress;
      const userAgent = req.headers["user-agent"];
      const referrer = (req.headers["referer"] || req.headers["referrer"]) as string | undefined;

      UrlService.recordClickAsync(url.id, ipAddress, userAgent, referrer);

      // Fast HTTP 302 Found redirect
      res.redirect(302, url.originalUrl);
    } catch (error) {
      console.error("[Redirection Error]:", error);
      res.status(500).send("Internal Server Error");
    }
  }

  /**
   * Lists URLs for the logged-in user with filters.
   */
  static async listUserUrls(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { search, groupId, isFavorite, isActive, page, limit } = req.query;

      const result = await UrlService.getUserUrls(userId, {
        search: search as string | undefined,
        groupId: groupId as string | undefined,
        isFavorite: isFavorite !== undefined ? isFavorite === "true" : undefined,
        isActive: isActive !== undefined ? isActive === "true" : undefined,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 10,
      });

      const urlsWithDomain = result.urls.map((u) => ({
        ...u,
        shortUrl: `${env.FRONTEND_URL}/s/${u.shortCode}`,
      }));

      res.status(200).json({
        success: true,
        data: {
          ...result,
          urls: urlsWithDomain,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Failed to fetch URLs" });
    }
  }

  /**
   * Updates an existing short URL.
   */
  static async update(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0]! : rawId!;

      const updateSchema = z.object({
        title: z.string().optional().nullable(),
        groupId: z.string().uuid().optional().nullable(),
        expiresAt: z.string().datetime().optional().nullable(),
        isActive: z.boolean().optional(),
        qrColorDark: z.string().optional(),
        qrColorLight: z.string().optional(),
      });

      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || "Validation error" });
        return;
      }

      const updated = await UrlService.updateUrl(id, userId, parsed.data);
      const urlWithDomain = {
        ...updated,
        shortUrl: `${env.FRONTEND_URL}/s/${updated.shortCode}`,
      };
      res.status(200).json({
        success: true,
        message: "URL updated successfully",
        data: { url: urlWithDomain },
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || "Failed to update URL" });
    }
  }

  /**
   * Toggles Favorite status.
   */
  static async toggleFavorite(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0]! : rawId!;

      const updated = await UrlService.toggleFavorite(id, userId);
      res.status(200).json({ success: true, data: { url: updated } });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || "Failed to toggle favorite" });
    }
  }

  /**
   * Toggles Active status.
   */
  static async toggleActive(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0]! : rawId!;

      const updated = await UrlService.toggleActive(id, userId);
      res.status(200).json({ success: true, data: { url: updated } });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || "Failed to toggle status" });
    }
  }

  /**
   * Deletes a user URL.
   */
  static async delete(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0]! : rawId!;

      await UrlService.deleteUrl(id, userId);
      res.status(200).json({ success: true, message: "URL deleted successfully" });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || "Failed to delete URL" });
    }
  }

  /**
   * Claims guest URLs stored in localStorage on login with claim token verification.
   */
  static async syncGuestUrls(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { claims } = req.body;

      if (!Array.isArray(claims)) {
        res.status(400).json({
          success: false,
          message: "claims array with shortCode and claimToken is required",
        });
        return;
      }

      const result = await UrlService.syncGuestUrls(claims, userId);
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Sync failed" });
    }
  }
}
