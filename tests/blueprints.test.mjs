import test from "node:test";
import assert from "node:assert/strict";
import { validateCatalog } from "../scripts/validate.mjs";

test("v1 public blueprint set is intentionally small", async () => {
  const { blueprints } = await validateCatalog();
  assert.deepEqual(
    blueprints.map((item) => item.id).sort(),
    ["extension", "extension-api", "mobile", "mobile-api", "service", "web", "web-api", "web-mobile-api"].sort(),
  );
});

test("web blueprints allow Next.js without making it the default", async () => {
  const { blueprints } = await validateCatalog();
  for (const id of ["web", "web-api", "web-mobile-api"]) {
    const blueprint = blueprints.find((item) => item.id === id);
    const web = blueprint.apps.find((app) => app.id === "web");
    assert.equal(web.foundation.default, "web-spa");
    assert.ok(web.foundation.alternatives.includes("web-nextjs"));
  }
});
