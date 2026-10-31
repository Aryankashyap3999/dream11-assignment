import { Router } from "express";
import { getReplay, pauseReplay, resetReplay, startReplay } from "../../controllers/demo.controller";

const router = Router();

router.get("/:matchId", getReplay);
router.post("/:matchId/start", startReplay);
router.post("/:matchId/pause", pauseReplay);
router.post("/:matchId/reset", resetReplay);

export default router;
