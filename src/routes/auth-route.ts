import { Router } from "express";
import { authLimiter } from "../middlewares/rate-limit.middleware";

export const authRouter = Router();

authRouter.use(authLimiter);

authRouter.post("/register", (_req, res) => {
  res.json({ message: "Register endpoint placeholder" });
});

authRouter.post("/login", (_req, res) => {
  res.json({ message: "Login endpoint placeholder" });
});

authRouter.post("/refresh-token", (_req, res) => {
  res.json({ message: "Refresh token rotation endpoint placeholder" });
});

authRouter.post("/logout", (_req, res) => {
  res.json({ message: "Logout endpoint placeholder" });
});
