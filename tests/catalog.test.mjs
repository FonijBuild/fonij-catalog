import test from "node:test";
import assert from "node:assert/strict";
import { validateCatalog } from "../scripts/validate.mjs";

test("catalog validates end-to-end", async () => {
  const result = await validateCatalog();
  assert.equal(result.catalog.schemaVersion, 1);
  assert.equal(result.foundations.length, 6);
  assert.equal(result.blueprints.length, 8);
  assert.equal(result.evolutions.length, 3);
});

test("all stable foundations use immutable v-prefixed release refs", async () => {
  const { foundations } = await validateCatalog();
  for (const foundation of foundations.filter((item) => item.status === "stable")) {
    assert.equal(foundation.source.ref, `v${foundation.source.version}`);
  }
});
