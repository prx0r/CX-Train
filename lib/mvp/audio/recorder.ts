import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const RECORDINGS_DIR = path.resolve(process.cwd(), 'data', 'recordings');

export interface RecordingInfo {
  id: string;
  assessmentToken: string;
  filePath: string;
  fileName: string;
  durationMs: number;
  sizeBytes: number;
  createdAt: string;
}

function ensureDir(): void {
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

export function generateRecordingId(): string {
  return crypto.randomUUID();
}

export function getRecordingPath(token: string, id: string): string {
  return path.join(RECORDINGS_DIR, `${token}-${id}.webm`);
}

export function saveRecording(
  audioBuffer: Buffer,
  token: string,
  durationMs: number,
): RecordingInfo {
  ensureDir();
  const id = generateRecordingId();
  const filePath = getRecordingPath(token, id);
  const fileName = path.basename(filePath);

  fs.writeFileSync(filePath, audioBuffer);

  return {
    id,
    assessmentToken: token,
    filePath,
    fileName,
    durationMs,
    sizeBytes: audioBuffer.length,
    createdAt: new Date().toISOString(),
  };
}

export function getRecordingStream(token: string, id: string): fs.ReadStream | null {
  const filePath = getRecordingPath(token, id);
  if (!fs.existsSync(filePath)) return null;
  return fs.createReadStream(filePath);
}

export function recordingExists(token: string, id: string): boolean {
  return fs.existsSync(getRecordingPath(token, id));
}

export function deleteRecording(token: string, id: string): boolean {
  const filePath = getRecordingPath(token, id);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}

export function getRecordingSize(token: string, id: string): number | null {
  const filePath = getRecordingPath(token, id);
  if (!fs.existsSync(filePath)) return null;
  return fs.statSync(filePath).size;
}

export function listRecordings(token: string): RecordingInfo[] {
  ensureDir();
  const prefix = `${token}-`;
  const files = fs.readdirSync(RECORDINGS_DIR).filter(f => f.startsWith(prefix));
  return files.map(f => {
    const stat = fs.statSync(path.join(RECORDINGS_DIR, f));
    const id = f.replace(prefix, '').replace('.webm', '');
    return {
      id,
      assessmentToken: token,
      filePath: path.join(RECORDINGS_DIR, f),
      fileName: f,
      durationMs: 0,
      sizeBytes: stat.size,
      createdAt: stat.birthtime.toISOString(),
    };
  });
}
