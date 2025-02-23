import { serve } from "https://deno.land/std@0.220.1/http/server.ts";
import { serveDir } from "https://deno.land/std@0.220.1/http/file_server.ts";

// Remove bundle import as it's not needed in production
// import { bundle } from "https://deno.land/x/emit@0.38.1/mod.ts";

// Create router to handle different paths
async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // Remove the TypeScript compilation part since we'll pre-compile our TypeScript files
  // Serve static files from the public directory
  return await serveDir(req, {
    fsRoot: "public",  // Change this to serve from public directory
    showDirListing: false,
  });
}

// Start the server
const port = parseInt(Deno.env.get("PORT") || "8000");
console.log(`Server running on port ${port}`);
await serve(handler, { port }); 