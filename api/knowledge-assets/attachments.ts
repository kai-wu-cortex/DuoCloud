import type { Request, Response } from 'express';
import {
  handleKnowledgeAttachmentUploadRequest,
  sendKnowledgeAttachmentError,
} from '../../src/server/knowledgeAttachmentApi.ts';

export default async function handler(req: Request, res: Response) {
  try {
    return await handleKnowledgeAttachmentUploadRequest(req, res);
  } catch (error) {
    return sendKnowledgeAttachmentError(res, error);
  }
}
