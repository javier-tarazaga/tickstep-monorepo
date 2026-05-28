/// <reference types="vite/client" />

export {};

interface ElectronAPI {
  platform: string;
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
  onDeepLink: (callback: (url: string) => void) => void;
  auth: {
    save: (auth: {
      user: { id: string; email: string };
      tokens: { accessToken: string; refreshToken: string };
    }) => Promise<void>;
    load: () => Promise<{
      user: { id: string; email: string };
      tokens: { accessToken: string; refreshToken: string };
    } | null>;
    clear: () => Promise<void>;
  };
}

declare global {
  interface ImportMetaEnv {
    readonly VITE_API_BASE_URL?: string;
  }

  interface Window {
    electronAPI: ElectronAPI;
  }
}
