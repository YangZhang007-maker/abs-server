import { memoryStorage } from 'multer';
import { Request } from 'express';
import { BadRequestException } from '@nestjs/common';

const ALLOWED_MIMES: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-excel': '.xls',
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/** 使用内存存储，文件流转发到 Supabase Storage */
export const multerConfig = {
  storage: memoryStorage(),
  fileFilter: (_req: Request, file: Express.Multer.File, cb) => {
    if (ALLOWED_MIMES[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new BadRequestException(`不支持的文件类型: ${file.mimetype}。仅支持 PDF、Word、Excel。`), false);
    }
  },
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
};

export { ALLOWED_MIMES, MAX_FILE_SIZE };