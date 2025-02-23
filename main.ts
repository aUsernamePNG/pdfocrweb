import { serve } from "https://deno.land/std@0.220.1/http/server.ts";
import { serveDir } from "https://deno.land/std@0.220.1/http/file_server.ts";
import { bundle } from "https://deno.land/x/emit@0.38.1/mod.ts";

// Create router to handle different paths
async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // Intercept requests for .js files that have a corresponding .ts file
  if (url.pathname.endsWith('.js')) {
    const tsPath = url.pathname.replace('.js', '.ts');
    try {
      await Deno.stat(`.${tsPath}`);
      // TypeScript file exists, compile and serve it
      const result = await bundle(`.${tsPath}`);
      return new Response(result.code, {
        headers: {
          "content-type": "application/javascript",
          "cache-control": "no-cache",
        },
      });
    } catch {
      // If no .ts file exists, fall through to static file serving
    }
  }

  // Serve other static files
  return await serveDir(req, {
    fsRoot: ".",
    showDirListing: false,
  });
}

// Start the server
const port = 8000;
console.log(`Server running on http://localhost:${port}`);
await serve(handler, { port }); 