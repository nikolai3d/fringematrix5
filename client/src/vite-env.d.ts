/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LOADING_SCREEN?: string;
  // Add other env variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
