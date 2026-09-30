import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/rbac.middleware";

export const adminRouter = Router();

// Protect all admin routes with auth and ADMIN role exclusively
adminRouter.use(authenticate, requireRole("ADMIN"));

adminRouter.get("/overview", (_req, res) => {
  res.json({ message: "Admin system overview placeholder" });
});

adminRouter.get("/urls", (_req, res) => {
  res.json({ message: "Admin all URLs list placeholder" });
});

adminRouter.patch("/urls/:id/ban", (_req, res) => {
  res.json({ message: "Admin ban link placeholder" });
});
