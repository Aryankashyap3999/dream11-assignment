import { Router } from "express";
import matchRoutes from "./match.routes";
import analysisRoutes from "./analysis.routes";
import aiRoutes from "./ai.routes";
import demoRoutes from "./demo.routes";

const router = Router();

router.use("/matches", matchRoutes);
router.use("/analysis", analysisRoutes);
router.use("/ai", aiRoutes);
router.use("/demo", demoRoutes);

export default router;
