// Type declarations for Deno runtime and Supabase Edge Functions

declare namespace Deno {
  export interface Env {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): void;
    toObject(): Record<string, string>;
  }
  export const env: Env;
  export function serve(handler: (request: Request) => Promise<Response> | Response): void;
}

declare module "https://esm.sh/*" {
  const content: any;
  export default content;
  export const createClient: any;
  export const PDFDocument: any;
}
