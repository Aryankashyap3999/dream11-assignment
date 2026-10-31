import type { Request, Response } from "express";
import * as analysisService from "../services/analysis.service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getMatchAnalysis(req: Request<{ matchId: string }>, res: Response) {
  const { matchId } = req.params;
  if (!UUID.test(matchId)) return res.status(400).json({ message: "Invalid matchId" });

  try {
    const analysis = await analysisService.getMatchAnalysis(matchId);
    if (!analysis) return res.status(404).json({ message: "Match not found" });
    res.json({ data: analysis });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
}
