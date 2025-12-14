import { Request, Response, NextFunction } from 'express';
import { sanitizeObject } from '../utils/sanitize.js';

/**
 * Middleware to sanitize request body
 * Removes any HTML/script tags from string values to prevent XSS attacks
 */
export const sanitizeBody = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
};

/**
 * Middleware to sanitize query parameters
 */
export const sanitizeQuery = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  next();
};

/**
 * Middleware to sanitize route parameters
 */
export const sanitizeParams = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }
  next();
};
