import type { Request, Response } from "express";
import * as aiService from "../services/ai.service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_QUESTION = 500;

function serverError(res: Response, error: unknown) {
  // message only: never log objects that might carry request config
  console.error(error instanceof Error ? error.message : "AI request failed");
  res.status(500).json({ message: "Internal server error" });
}

export async function getInsights(req: Request<{ matchId: string }>, res: Response) {
  const { matchId } = req.params;
  if (!UUID.test(matchId)) return res.status(400).json({ message: "Invalid matchId" });

  try {
    const insight = await aiService.getInsight(matchId);
    if (!insight) return res.status(404).json({ message: "Match not found" });
    res.json({ data: insight });
  } catch (error) {
    serverError(res, error);
  }
}

export async function askQuestion(req: Request<{ matchId: string }>, res: Response) {
  const { matchId } = req.params;
  if (!UUID.test(matchId)) return res.status(400).json({ message: "Invalid matchId" });

  const question = req.body?.question;
  if (typeof question !== "string" || !question.trim() || question.length > MAX_QUESTION) {
    return res.status(400).json({ message: "Invalid question" });
  }

  try {
    const answer = await aiService.askQuestion(matchId, question.trim());
    if (!answer) return res.status(404).json({ message: "Match not found" });
    res.json({ data: answer });
  } catch (error) {
    serverError(res, error);
  }
}
