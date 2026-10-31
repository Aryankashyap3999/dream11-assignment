import { Router } from "express";
import { getMatchAnalysis } from "../../controllers/analysis.controller";

const router = Router();

router.get("/:matchId", getMatchAnalysis);

export default router;
