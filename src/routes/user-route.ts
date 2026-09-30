import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/rbac.middleware";

export const userRouter = Router();

// Protect all user routes with auth and USER/ADMIN role
userRouter.use(authenticate, requireRole("USER", "ADMIN"));

userRouter.get("/profile", (req, res) => {
  res.json({ message: "User profile placeholder", user: req.user });
});

userRouter.get("/urls", (_req, res) => {
  res.json({ message: "User URLs list placeholder" });
});

userRouter.post("/urls", (_req, res) => {
  res.json({ message: "Create short URL placeholder" });
});

userRouter.get("/groups", (_req, res) => {
  res.json({ message: "User URL groups placeholder" });
});
