import type { Request, Response } from "express";
import * as replay from "../services/replay.service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const handler = (action: (matchId: string) => Promise<replay.ReplayState | null>) =>
  async (req: Request<{ matchId: string }>, res: Response) => {
    const { matchId } = req.params;
    if (!UUID.test(matchId)) return res.status(400).json({ message: "Invalid matchId" });
    try {
      const state = await action(matchId);
      if (!state) return res.status(404).json({ message: "Match not found" });
      res.json({ data: state });
    } catch (error) {
      if (error instanceof replay.ReplayConflictError) return res.status(409).json({ message: error.message });
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  };

export const getReplay = handler(replay.getReplayState);
export const startReplay = handler(replay.startReplay);
export const pauseReplay = handler(replay.pauseReplay);
export const resetReplay = handler(replay.resetReplay);
