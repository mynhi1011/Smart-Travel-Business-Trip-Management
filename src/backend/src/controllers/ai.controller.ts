/**
 * ai.controller.ts — AI Itinerary Generation Controller
 *
 * Handles: POST /api/v1/ai/generate-itinerary
 * Validate request (zod) → gọi AIService với guardrail BR-TR-07.
 * Input invalid → 400, KHÔNG gọi AI.
 */

import { Request, Response, NextFunction } from 'express';
import { generateItinerarySchema } from '../utils/validators/ai.validator';
import * as aiService from '../services/ai.service';
import { Errors } from '../middlewares/error-handler';
import { sendSuccess } from '../utils/response.utils';

export async function generateItinerary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user?.id) { next(Errors.UNAUTHORIZED()); return; }

    const parsed = generateItinerarySchema.safeParse(req.body);
    if (!parsed.success) {
      next(Errors.VALIDATION_ERROR(parsed.error.flatten() as Record<string, unknown>));
      return;
    }

    const result = await aiService.generateItineraryDraft(req.user.id, parsed.data);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}
