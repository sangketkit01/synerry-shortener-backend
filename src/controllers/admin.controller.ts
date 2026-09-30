import { Request, Response } from "express";
import { AdminService } from "../services/admin.service";
import { env } from "../config/env";

export class AdminController {
  /**
   * GET /api/v1/admin/urls
   */
  static async listAllUrls(req: Request, res: Response): Promise<void> {
    try {
      const { search, status, page, limit } = req.query;

      const result = await AdminService.getAllUrls({
        search: search as string | undefined,
        status: status as any,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 15,
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
      res.status(500).json({
        success: false,
        message: error.message || "Failed to load URLs for moderation",
      });
    }
  }

  /**
   * PATCH /api/v1/admin/urls/:id/ban
   */
  static async banUrl(req: Request, res: Response): Promise<void> {
    try {
      const adminId = req.user!.userId;
      const rawId = req.params.id;
      const urlId = Array.isArray(rawId) ? rawId[0]! : rawId!;
      const { reason } = req.body;

      if (!reason || typeof reason !== "string") {
        res.status(400).json({
          success: false,
          message: "A valid suspension reason is required",
        });
        return;
      }

      const updated = await AdminService.banUrl(urlId, adminId, reason);

      res.status(200).json({
        success: true,
        message: "URL has been suspended successfully",
        data: { url: updated },
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to ban URL",
      });
    }
  }

  /**
   * PATCH /api/v1/admin/urls/:id/unban
   */
  static async unbanUrl(req: Request, res: Response): Promise<void> {
    try {
      const rawId = req.params.id;
      const urlId = Array.isArray(rawId) ? rawId[0]! : rawId!;

      const updated = await AdminService.unbanUrl(urlId);

      res.status(200).json({
        success: true,
        message: "URL suspension has been removed",
        data: { url: updated },
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to unban URL",
      });
    }
  }

  /**
   * DELETE /api/v1/admin/urls/:id
   */
  static async deleteUrl(req: Request, res: Response): Promise<void> {
    try {
      const rawId = req.params.id;
      const urlId = Array.isArray(rawId) ? rawId[0]! : rawId!;

      await AdminService.deleteUrl(urlId);

      res.status(200).json({
        success: true,
        message: "URL deleted permanently by administrator",
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to delete URL",
      });
    }
  }

  /**
   * GET /api/v1/admin/overview
   */
  static async overview(_req: Request, res: Response): Promise<void> {
    try {
      const stats = await AdminService.getOverview();
      res.status(200).json({ success: true, data: { stats } });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Failed to load overview" });
    }
  }

  /**
   * GET /api/v1/admin/users
   */
  static async listUsers(_req: Request, res: Response): Promise<void> {
    try {
      const users = await AdminService.getUsers();
      res.status(200).json({ success: true, data: { users } });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Failed to list users" });
    }
  }

  /**
   * PATCH /api/v1/admin/users/:id/ban
   */
  static async banUser(req: Request, res: Response): Promise<void> {
    try {
      const rawId = req.params.id;
      const userId = Array.isArray(rawId) ? rawId[0]! : rawId!;
      const { reason } = req.body;
      const adminId = req.user!.userId;

      const updated = await AdminService.banUser(userId, adminId, reason || "");

      res.status(200).json({
        success: true,
        message: "User account suspended successfully",
        data: { user: updated },
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to suspend user account",
      });
    }
  }

  /**
   * PATCH /api/v1/admin/users/:id/unban
   */
  static async unbanUser(req: Request, res: Response): Promise<void> {
    try {
      const rawId = req.params.id;
      const userId = Array.isArray(rawId) ? rawId[0]! : rawId!;

      const updated = await AdminService.unbanUser(userId);

      res.status(200).json({
        success: true,
        message: "User suspension lifted successfully",
        data: { user: updated },
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to unban user account",
      });
    }
  }
}
