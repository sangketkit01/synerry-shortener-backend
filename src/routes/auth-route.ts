import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authLimiter } from "../middlewares/rate-limit.middleware";
import { authenticate } from "../middlewares/auth.middleware";

export const authRouter = Router();

authRouter.post("/register", authLimiter, AuthController.register);
authRouter.post("/login", authLimiter, AuthController.login);
authRouter.post("/refresh-token", AuthController.refreshToken);
authRouter.post("/logout", AuthController.logout);
authRouter.get("/me", authenticate, AuthController.me);
