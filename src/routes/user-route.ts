import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/rbac.middleware";
import { resourceCreationLimiter } from "../middlewares/rate-limit.middleware";
import { UrlController } from "../controllers/url.controller";
import { GroupController } from "../controllers/group.controller";

export const userRouter = Router();

// Protect all user routes with auth and USER/ADMIN role
userRouter.use(authenticate, requireRole("USER", "ADMIN"));

// URLs Management
userRouter.get("/urls", UrlController.listUserUrls);
userRouter.post("/urls", UrlController.create);
userRouter.patch("/urls/:id", UrlController.update);
userRouter.patch("/urls/:id/favorite", UrlController.toggleFavorite);
userRouter.patch("/urls/:id/toggle-active", UrlController.toggleActive);
userRouter.delete("/urls/:id", UrlController.delete);

// Guest to User Sync
userRouter.post("/urls/sync-guest", UrlController.syncGuestUrls);
userRouter.post("/urls/sync", UrlController.syncGuestUrls);

// Groups / Folders Management
userRouter.get("/groups", GroupController.list);
userRouter.post("/groups", resourceCreationLimiter, GroupController.create);
userRouter.patch("/groups/:id", GroupController.update);
userRouter.delete("/groups/:id", GroupController.delete);
