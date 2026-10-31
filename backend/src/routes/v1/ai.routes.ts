import { Router } from "express";
import { askQuestion, getInsights } from "../../controllers/ai.controller";

const router = Router();

router.get("/:matchId/insights", getInsights);
router.post("/:matchId/ask", askQuestion);

export default router;
