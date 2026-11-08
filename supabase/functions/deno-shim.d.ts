// Tipet minimale të Deno-s për kontrollin e tipeve të funksioneve me tsc (`npm run lint`), pa Deno në
// ambient: vetëm ato që funksionet përdorin. Supabase-i i Deno-s (npm:) merr tipet e paketës në node_modules.
declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (req: Request) => Response | Promise<Response>): void
}
declare module 'npm:@supabase/supabase-js@2.118.0' {
  export * from '@supabase/supabase-js'
}
