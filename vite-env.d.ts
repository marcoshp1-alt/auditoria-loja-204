// Fix: Removed problematic reference to 'vite/client' which was not found in the environment
// and defined ImportMetaEnv locally to resolve "Cannot find name 'ImportMetaEnv'"

interface ImportMetaEnv {
  [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace NodeJS {
  interface ProcessEnv {
    API_KEY: string;
  }
}
