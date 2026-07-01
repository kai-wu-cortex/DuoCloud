import type { Request, Response } from 'express';
import { loginApiHandler } from '../src/server/loginApi';
import { sendApiError } from '../src/server/sessionAuth';

export default async function handler(req: Request, res: Response): Promise<void> {
  try {
    await loginApiHandler(req, res);
  } catch (error) {
    sendApiError(res, error);
  }
}
