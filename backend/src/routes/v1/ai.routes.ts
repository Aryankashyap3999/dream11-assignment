import { Router } from "express";
import { rateLimit } from "../../middleware/rate-limit";
import { askQuestion, getInsights } from "../../controllers/ai.controller";

const router = Router();

// Both routes spend LLM quota: AI_RATE_LIMIT_PER_MIN requests per IP per minute.
router.use(rateLimit(Number(process.env.AI_RATE_LIMIT_PER_MIN) || 20));

router.get("/:matchId/insights", getInsights);
router.post("/:matchId/ask", askQuestion);

export default router;
