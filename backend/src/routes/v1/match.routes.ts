import { Router } from "express";
import {
  getMatchById,
  getMatchScorecard,
  getMatches,
} from "../../controllers/match.controller";

const router = Router();

router.get("/", getMatches);
router.get("/:matchId", getMatchById);
router.get("/:matchId/scorecard", getMatchScorecard);

export default router;
