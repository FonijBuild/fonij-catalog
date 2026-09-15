import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, "..");

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

function formatErrors(errors = []) {
  return errors
    .map((error) => `  - ${error.instancePath || "/"} ${error.message ?? "is invalid"}`)
    .join("\n");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function uniqueBy(items, key, label) {
  const seen = new Set();
  for (const item of items) {
    const value = item[key];
    assert(!seen.has(value), `Duplicate ${label} id: ${value}`);
    seen.add(value);
  }
}

async function loadListed(root, paths) {
  return Promise.all(paths.map(async (relative) => ({
    relative,
    value: await readJson(path.resolve(root, relative)),
  })));
}

function createAjv() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  return ajv;
}

async function compileSchema(ajv, file) {
  const schema = await readJson(path.join(ROOT, "schemas", file));
  return ajv.compile(schema);
}

function validateDocument(validate, document, label) {
  if (!validate(document)) {
    throw new Error(`${label} failed schema validation:\n${formatErrors(validate.errors)}`);
  }
}

function validateFoundationSemantics(foundations) {
  uniqueBy(foundations, "id", "foundation");
  const ids = new Set(foundations.map((item) => item.id));

  for (const foundation of foundations) {
    assert(!foundation.compatibleWith.includes(foundation.id), `${foundation.id} cannot be compatible with itself.`);
    for (const compatible of foundation.compatibleWith) {
      assert(ids.has(compatible), `${foundation.id} references unknown compatible foundation ${compatible}.`);
    }
    if (foundation.status === "stable") {
      assert(foundation.source.ref !== "main" && foundation.source.ref !== "master", `${foundation.id} is stable but points to a mutable branch.`);
      assert(foundation.source.ref === `v${foundation.source.version}`, `${foundation.id} ref/version mismatch: expected v${foundation.source.version}.`);
    }
  }
}

function validateBlueprintSemantics(blueprints, foundations) {
  uniqueBy(blueprints, "id", "blueprint");
  const foundationById = new Map(foundations.map((item) => [item.id, item]));

  for (const blueprint of blueprints) {
    const paths = new Set();
    const apps = new Set();
    const actualTargets = new Set();

    for (const app of blueprint.apps) {
      assert(!paths.has(app.path), `${blueprint.id} uses duplicate app path ${app.path}.`);
      assert(!apps.has(app.id), `${blueprint.id} uses duplicate app id ${app.id}.`);
      paths.add(app.path);
      apps.add(app.id);
      actualTargets.add(app.target);

      const candidates = [app.foundation.default, ...app.foundation.alternatives];
      for (const candidate of candidates) {
        const foundation = foundationById.get(candidate);
        assert(foundation, `${blueprint.id}/${app.id} references unknown foundation ${candidate}.`);
        assert(foundation.target === app.target, `${blueprint.id}/${app.id}: foundation ${candidate} targets ${foundation.target}, expected ${app.target}.`);
      }
    }

    assert(
      [...actualTargets].sort().join(",") === [...blueprint.targets].sort().join(","),
      `${blueprint.id} targets must exactly match its app targets.`,
    );

    if (blueprint.workspace === "standalone") {
      assert(blueprint.apps.length === 1, `${blueprint.id} is standalone but defines ${blueprint.apps.length} apps.`);
      assert(blueprint.apps[0].path === ".", `${blueprint.id} standalone app must use path '.'.`);
    } else {
      for (const app of blueprint.apps) {
        assert(app.path.startsWith("apps/"), `${blueprint.id} monorepo app ${app.id} must live under apps/.`);
      }
    }
  }
}

function validateEvolutionSemantics(evolutions, blueprints, foundations) {
  uniqueBy(evolutions, "id", "evolution");
  const blueprintById = new Map(blueprints.map((item) => [item.id, item]));
  const foundationById = new Map(foundations.map((item) => [item.id, item]));

  for (const evolution of evolutions) {
    const from = blueprintById.get(evolution.fromBlueprint);
    const to = blueprintById.get(evolution.toBlueprint);
    assert(from, `${evolution.id} references unknown fromBlueprint ${evolution.fromBlueprint}.`);
    assert(to, `${evolution.id} references unknown toBlueprint ${evolution.toBlueprint}.`);
    assert(from.id !== to.id, `${evolution.id} must change the blueprint.`);

    for (const operation of evolution.operations) {
      if (operation.type === "move-app") {
        assert(from.apps.some((app) => app.id === operation.app), `${evolution.id} moves unknown source app ${operation.app}.`);
        const targetApp = to.apps.find((app) => app.id === operation.app);
        assert(targetApp, `${evolution.id} moves app ${operation.app}, but target blueprint does not contain it.`);
        assert(targetApp.path === operation.to, `${evolution.id} move destination for ${operation.app} does not match target blueprint.`);
      }

      if (operation.type === "add-foundation") {
        const foundation = foundationById.get(operation.foundation);
        assert(foundation, `${evolution.id} adds unknown foundation ${operation.foundation}.`);
        assert(foundation.target === operation.target, `${evolution.id} target mismatch for ${operation.foundation}.`);
        const targetApp = to.apps.find((app) => app.id === operation.app);
        assert(targetApp, `${evolution.id} adds ${operation.app}, but target blueprint does not contain it.`);
        assert(targetApp.target === operation.target, `${evolution.id} added target does not match target blueprint.`);
        assert(targetApp.path === operation.path, `${evolution.id} added path does not match target blueprint.`);
        assert([targetApp.foundation.default, ...targetApp.foundation.alternatives].includes(operation.foundation), `${evolution.id} foundation ${operation.foundation} is not allowed by target blueprint ${to.id}.`);
      }

      if (operation.type === "create-workspace") {
        assert(to.workspace === "monorepo", `${evolution.id} creates a workspace but target blueprint is not a monorepo.`);
      }
    }
  }
}

export async function validateCatalog() {
  const ajv = createAjv();
  const [catalogValidate, foundationValidate, blueprintValidate, evolutionValidate] = await Promise.all([
    compileSchema(ajv, "catalog.schema.json"),
    compileSchema(ajv, "foundation.schema.json"),
    compileSchema(ajv, "blueprint.schema.json"),
    compileSchema(ajv, "evolution.schema.json"),
  ]);

  const catalog = await readJson(path.join(ROOT, "catalog.json"));
  validateDocument(catalogValidate, catalog, "catalog.json");

  const [foundationEntries, blueprintEntries, evolutionEntries] = await Promise.all([
    loadListed(ROOT, catalog.foundations),
    loadListed(ROOT, catalog.blueprints),
    loadListed(ROOT, catalog.evolutions),
  ]);

  for (const entry of foundationEntries) validateDocument(foundationValidate, entry.value, entry.relative);
  for (const entry of blueprintEntries) validateDocument(blueprintValidate, entry.value, entry.relative);
  for (const entry of evolutionEntries) validateDocument(evolutionValidate, entry.value, entry.relative);

  const foundations = foundationEntries.map((entry) => entry.value);
  const blueprints = blueprintEntries.map((entry) => entry.value);
  const evolutions = evolutionEntries.map((entry) => entry.value);

  validateFoundationSemantics(foundations);
  validateBlueprintSemantics(blueprints, foundations);
  validateEvolutionSemantics(evolutions, blueprints, foundations);


  return {
    catalog,
    foundations,
    blueprints,
    evolutions
  };
}

async function main() {
  const result = await validateCatalog();
  console.log(`✓ catalog ${result.catalog.catalogVersion}`);
  console.log(`✓ ${result.foundations.length} foundations`);
  console.log(`✓ ${result.blueprints.length} blueprints`);
  console.log(`✓ ${result.evolutions.length} evolutions`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`✗ ${error.message}`);
    process.exitCode = 1;
  });
}
