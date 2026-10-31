import type { Request, Response } from "express";
import * as matchService from "../services/match.service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function serverError(res: Response, error: unknown) {
  console.error(error);
  res.status(500).json({ message: "Internal server error" });
}

export async function getMatches(_req: Request, res: Response) {
  try {
    res.json({ data: await matchService.getMatches() });
  } catch (error) {
    serverError(res, error);
  }
}

export async function getMatchById(req: Request<{ matchId: string }>, res: Response) {
  const { matchId } = req.params;
  if (!UUID.test(matchId)) return res.status(400).json({ message: "Invalid matchId" });

  try {
    const match = await matchService.getMatchById(matchId);
    if (!match) return res.status(404).json({ message: "Match not found" });
    res.json({ data: match });
  } catch (error) {
    serverError(res, error);
  }
}

export async function getMatchScorecard(req: Request<{ matchId: string }>, res: Response) {
  const { matchId } = req.params;
  if (!UUID.test(matchId)) return res.status(400).json({ message: "Invalid matchId" });

  try {
    const scorecard = await matchService.getMatchScorecard(matchId);
    if (!scorecard) return res.status(404).json({ message: "Match not found" });
    res.json({ data: scorecard });
  } catch (error) {
    serverError(res, error);
  }
}
