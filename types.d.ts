// miniapp-frontend/types.d.ts
// Ini adalah "Aturan Tambahan" yang kita ajarkan kepada TypeScript.

// Mendeklarasikan bahwa semua properti string yang dimulai dengan 'fc:' diizinkan
// dalam properti 'other' dari Metadata Next.js.
declare module 'next/dist/lib/metadata/types/metadata-types' {
  interface Metadata {
    other?: Record<string, string | string[]>;
  }
}