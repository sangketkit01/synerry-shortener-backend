import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/rbac.middleware";
import { UrlController } from "../controllers/url.controller";

export const userRouter = Router();

// Protect all user routes with auth and USER/ADMIN role
userRouter.use(authenticate, requireRole("USER", "ADMIN"));

// URLs Management
userRouter.get("/urls", UrlController.listUserUrls);
userRouter.post("/urls", UrlController.create);
userRouter.patch("/urls/:id/favorite", UrlController.toggleFavorite);
userRouter.patch("/urls/:id/toggle-active", UrlController.toggleActive);
userRouter.delete("/urls/:id", UrlController.delete);

// Guest to User Sync
userRouter.post("/urls/sync-guest", UrlController.syncGuestUrls);

// Groups Placeholder (will be expanded in Groups phase)
userRouter.get("/groups", (_req, res) => {
  res.json({ success: true, data: { groups: [] } });
});
