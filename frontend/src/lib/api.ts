/**
 * Backend API base address.
 *
 * - Local dev: leave empty, Vite proxy forwards to http://localhost:7860
 * - Docker production: leave empty, nginx proxy forwards to backend:7860
 * - Vercel / standalone frontend: set VITE_API_BASE_URL=https://your-backend.example.com
 */
export const API_BASE: string = (import.meta.env.VITE_API_BASE_URL as string) ?? ''