import { Router } from "express";
import { publicRouter } from "./public-route";
import { authRouter } from "./auth-route";
import { userRouter } from "./user-route";
import { adminRouter } from "./admin-route";
import { internalRouter } from "./internal-route";

export const rootRouter = Router();

// Register role-based and functional routes
rootRouter.use("/public", publicRouter);
rootRouter.use("/auth", authRouter);
rootRouter.use("/user", userRouter);
rootRouter.use("/admin", adminRouter);
rootRouter.use("/internal", internalRouter);
