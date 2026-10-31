import { Router } from "express";

const router = Router();

// ponytail: placeholder handlers, replace with controllers
router.get("/:matchId", (_req, res) => {
  res.status(501).json({ message: "Not implemented" });
});

export default router;
