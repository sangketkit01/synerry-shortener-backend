import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/rbac.middleware";
import { AdminController } from "../controllers/admin.controller";

export const adminRouter = Router();

// Protect all admin routes exclusively for authenticated users with ADMIN role
adminRouter.use(authenticate, requireRole("ADMIN"));

// Overview & User Management
adminRouter.get("/overview", AdminController.overview);
adminRouter.get("/users", AdminController.listUsers);
adminRouter.patch("/users/:id/ban", AdminController.banUser);
adminRouter.patch("/users/:id/unban", AdminController.unbanUser);

// Moderation URLs
adminRouter.get("/urls", AdminController.listAllUrls);
adminRouter.patch("/urls/:id/ban", AdminController.banUrl);
adminRouter.patch("/urls/:id/unban", AdminController.unbanUrl);
adminRouter.delete("/urls/:id", AdminController.deleteUrl);
