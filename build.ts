// Build script to compile TypeScript to JavaScript
const result = await Deno.emit("script.ts", {
  bundle: "module",
  compilerOptions: {
    lib: ["dom", "dom.iterable", "dom.asynciterable", "deno.ns"],
  },
});

// Write the bundled JavaScript to script.js
await Deno.writeTextFile("script.js", result.files["deno:///bundle.js"]);
console.log("Built script.js successfully!"); 