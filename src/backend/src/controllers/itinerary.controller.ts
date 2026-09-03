import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/itinerary.service';
import { Errors } from '../middlewares/error-handler';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/response.utils';

export async function getItinerary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) { next(Errors.UNAUTHORIZED()); return; }
    const result = await svc.getItinerary(req.params['id'] ?? '', req.user.id, req.user.role);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

export async function addItineraryItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) { next(Errors.UNAUTHORIZED()); return; }
    const item = await svc.addItineraryItem(req.params['id'] ?? '', req.user.id, req.body as svc.ItineraryItemInput);
    sendCreated(res, item);
  } catch (err) { next(err); }
}

export async function updateItineraryItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) { next(Errors.UNAUTHORIZED()); return; }
    const item = await svc.updateItineraryItem(req.params['id'] ?? '', req.params['itemId'] ?? '', req.user.id, req.body as Partial<svc.ItineraryItemInput>);
    sendSuccess(res, item);
  } catch (err) { next(err); }
}

export async function deleteItineraryItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) { next(Errors.UNAUTHORIZED()); return; }
    await svc.deleteItineraryItem(req.params['id'] ?? '', req.params['itemId'] ?? '', req.user.id);
    sendNoContent(res);
  } catch (err) { next(err); }
}
