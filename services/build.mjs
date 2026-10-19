// Bundles each Lambda handler (including the shared engine from web/src/lib/engine)
// into dist/<name>/index.mjs for the SAM template.
import { build } from "esbuild";

const handlers = ["catalogue-ingest", "textract-complete", "match-assist", "hubspot-sync"];

await Promise.all(
  handlers.map((name) =>
    build({
      entryPoints: [`src/${name}.ts`],
      outfile: `dist/${name}/index.mjs`,
      bundle: true,
      platform: "node",
      target: "node22",
      format: "esm",
      sourcemap: true,
      // The AWS SDK v3 ships in the Lambda Node.js runtime.
      external: ["@aws-sdk/*"],
      banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
    }),
  ),
);
console.log(`Built ${handlers.length} handlers`);
