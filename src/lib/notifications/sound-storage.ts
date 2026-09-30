import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import crypto from "crypto";

export const ALLOWED_AUDIO_EXTENSIONS = [".mp3", ".wav", ".m4a", ".aac", ".ogg", ".webm"];

export const ALLOWED_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/x-pn-wav",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
  "audio/ogg",
  "audio/webm",
  "audio/x-aac",
];

export const MAX_AUDIO_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
export const RECOMMENDED_DURATION_SECONDS = 10;

export interface AudioValidationResult {
  valid: boolean;
  error?: string;
  detectedExtension?: string;
  sanitizedOriginalName?: string;
}

/**
 * Validates audio magic bytes to ensure file is legitimate audio and not an executable/script.
 */
export function validateAudioMagicBytes(buffer: Buffer): { valid: boolean; format?: string } {
  if (!buffer || buffer.length < 4) {
    return { valid: false };
  }

  // 1. MP3 with ID3 tag ('ID3')
  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    return { valid: true, format: "mp3" };
  }

  // 2. AAC ADTS (0xFFF1, 0xFFF9 or sync bits with layer 00)
  if (buffer[0] === 0xff && (buffer[1] === 0xf1 || buffer[1] === 0xf9 || (buffer[1] & 0xf6) === 0xf0)) {
    return { valid: true, format: "aac" };
  }

  // 3. MP3 frame sync (0xFFFB, 0xFFF3, 0xFFF2, 0xFFE3 with Layer I/II/III)
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0 && (buffer[1] & 0x06) !== 0x00) {
    return { valid: true, format: "mp3" };
  }

  // 4. WAV (RIFF....WAVE)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x41 &&
    buffer[10] === 0x56 &&
    buffer[11] === 0x45
  ) {
    return { valid: true, format: "wav" };
  }

  // 5. M4A / MP4 Audio (ftyp box with M4A, mp42, isom, M4B)
  if (buffer.length >= 8) {
    const ftypCheck = buffer.slice(4, 8).toString("latin1");
    if (ftypCheck === "ftyp") {
      return { valid: true, format: "m4a" };
    }
  }

  // 5. OGG (OggS)
  if (
    buffer[0] === 0x4f &&
    buffer[1] === 0x67 &&
    buffer[2] === 0x67 &&
    buffer[3] === 0x53
  ) {
    return { valid: true, format: "ogg" };
  }

  // 6. WEBM (EBML ID: 0x1A 0x45 0xDF 0xA3)
  if (
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return { valid: true, format: "webm" };
  }

  return { valid: false };
}

/**
 * Sanitize filename to prevent directory traversal or control characters.
 */
export function sanitizeFilename(originalName: string): string {
  const base = path.basename(originalName);
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 100);
}

/**
 * Validates audio file upload.
 */
export function validateAudioUpload(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
  declaredDuration?: number
): AudioValidationResult {
  if (!fileBuffer || fileBuffer.length === 0) {
    return { valid: false, error: "Arquivo de áudio vazio ou não recebido." };
  }

  if (fileBuffer.length > MAX_AUDIO_FILE_SIZE) {
    return {
      valid: false,
      error: `Arquivo excede o tamanho máximo de ${MAX_AUDIO_FILE_SIZE / (1024 * 1024)}MB.`,
    };
  }

  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_AUDIO_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Formato de arquivo '${ext}' não suportado. Utilize MP3, WAV, M4A, AAC, OGG ou WEBM.`,
    };
  }

  const normalizedMime = (mimeType || "").toLowerCase().trim();
  const isAllowedMime =
    ALLOWED_MIME_TYPES.includes(normalizedMime) || normalizedMime.startsWith("audio/");
  if (!isAllowedMime) {
    return {
      valid: false,
      error: `Tipo MIME '${mimeType}' inválido. Apenas arquivos de áudio são permitidos.`,
    };
  }

  const magicCheck = validateAudioMagicBytes(fileBuffer);
  if (!magicCheck.valid) {
    return {
      valid: false,
      error: "O arquivo enviado não possui uma assinatura de áudio válida ou está corrompido.",
    };
  }

  const sanitized = sanitizeFilename(filename);

  return {
    valid: true,
    detectedExtension: ext,
    sanitizedOriginalName: sanitized,
  };
}

/**
 * Save audio file locally into workspace isolated directory.
 */
export async function saveAudioFile(
  workspaceId: string,
  notificationType: string,
  fileBuffer: Buffer,
  originalFilename: string
): Promise<{ storagePath: string; fileName: string }> {
  const ext = path.extname(originalFilename).toLowerCase() || ".mp3";
  const uniqueId = crypto.randomBytes(16).toString("hex");
  const internalFileName = `${notificationType}_${uniqueId}${ext}`;

  // Base upload directory: uploads/notification-sounds/{workspaceId}/
  const uploadDir = path.join(process.cwd(), "uploads", "notification-sounds", workspaceId);
  await fs.mkdir(uploadDir, { recursive: true });

  const storagePath = path.join(uploadDir, internalFileName);
  await fs.writeFile(storagePath, fileBuffer);

  return {
    storagePath,
    fileName: internalFileName,
  };
}

/**
 * Delete audio file from storage safely.
 */
export async function deleteAudioFile(storagePath: string): Promise<boolean> {
  try {
    if (storagePath && fsSync.existsSync(storagePath)) {
      await fs.unlink(storagePath);
      return true;
    }
  } catch (err) {
    console.error(`[Sound Storage] Erro ao deletar arquivo ${storagePath}:`, err);
  }
  return false;
}
