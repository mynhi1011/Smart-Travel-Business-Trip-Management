/**
 * ai.controller.ts — AI Itinerary Generation Controller
 *
 * Handles: POST /ai/generate-itinerary
 * Gọi AIService với guardrail BR-TR-07
 * TODO: Implement đầy đủ khi xây dựng AI feature
 */

import { Request, Response, NextFunction } from 'express';

export async function generateItinerary(
  _req: Request, res: Response, _next: NextFunction
): Promise<void> {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'generateItinerary — TODO' });
}
