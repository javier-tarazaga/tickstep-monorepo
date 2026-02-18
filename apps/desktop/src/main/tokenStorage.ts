import { safeStorage, app } from "electron";
import { promises as fs } from "fs";
import path from "path";

const STORAGE_FILE = "auth-tokens.enc";

interface StoredAuth {
  user: { id: string; email: string };
  tokens: { accessToken: string; refreshToken: string };
}

function getFilePath(): string {
  return path.join(app.getPath("userData"), STORAGE_FILE);
}

export async function saveAuth(auth: StoredAuth): Promise<void> {
  const json = JSON.stringify(auth);
  const encrypted = safeStorage.encryptString(json);
  await fs.writeFile(getFilePath(), encrypted);
}

export async function loadAuth(): Promise<StoredAuth | null> {
  try {
    const encrypted = await fs.readFile(getFilePath());
    const json = safeStorage.decryptString(encrypted);
    return JSON.parse(json) as StoredAuth;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    // Corrupted data — clear it
    await clearAuth();
    return null;
  }
}

export async function clearAuth(): Promise<void> {
  try {
    await fs.unlink(getFilePath());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}
