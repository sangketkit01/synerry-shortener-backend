import { Request, Response } from "express";
import { GroupService } from "../services/group.service";

export class GroupController {
  /**
   * GET /api/v1/user/groups
   */
  static async list(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const groups = await GroupService.getUserGroups(userId);
      res.status(200).json({ success: true, data: { groups } });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Failed to list groups" });
    }
  }

  /**
   * POST /api/v1/user/groups
   */
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { name, color } = req.body;
      const group = await GroupService.createGroup(userId, name, color);
      res.status(201).json({ success: true, data: { group } });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || "Failed to create group" });
    }
  }

  /**
   * PATCH /api/v1/user/groups/:id
   */
  static async update(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0]! : rawId!;
      const { name, color } = req.body;

      const updated = await GroupService.updateGroup(id, userId, name, color);
      res.status(200).json({ success: true, data: { group: updated } });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || "Failed to update group" });
    }
  }

  /**
   * DELETE /api/v1/user/groups/:id
   */
  static async delete(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0]! : rawId!;

      await GroupService.deleteGroup(id, userId);
      res.status(200).json({ success: true, message: "Group deleted successfully" });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || "Failed to delete group" });
    }
  }
}
