import { editorialSchema } from "../../lib/editorial";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { parseDocument } from "yaml";
import {
  coffeeSchema,
  lotSchema,
  offerSchema,
  homeSchema,
} from "../../lib/content-schema";
test("Pages CMS config is valid YAML, covers every content field and stores stable reference IDs", () => {
  const doc = parseDocument(readFileSync(".pages.yml", "utf8"));
  assert.deepEqual(doc.errors, []);
  const config = doc.toJS();
  assert.equal(config.media.input, "public/media");
  assert.equal(config.media.output, "/media");
  assert.equal(config.settings.content.merge, true);
  const schemas = {
    coffees: coffeeSchema,
    lots: lotSchema,
    offers: offerSchema,
    home: homeSchema,
    site: editorialSchema,
  };
  const site = config.content.find(
    (item: { name: string }) => item.name === "site",
  );
  for (const name of ["hero", "business"] as const) {
    const fields = site.fields.find(
      (field: { name: string }) => field.name === name,
    ).fields;
    assert.deepEqual(
      fields.map((field: { name: string }) => field.name).sort(),
      Object.keys(editorialSchema.shape[name].shape).sort(),
    );
  }
  for (const [name, schema] of Object.entries(schemas)) {
    const collection = config.content.find(
      (item: { name: string }) => item.name === name,
    );
    assert.ok(collection);
    assert.deepEqual(
      collection.fields.map((field: { name: string }) => field.name).sort(),
      Object.keys(schema.shape).sort(),
    );
    if (name !== "home" && name !== "site") {
      assert.equal(collection.format, "json");
      assert.equal(collection.filename.template, "{fields.id}.json");
      assert.equal(collection.operations.delete, false);
      assert.equal(collection.operations.rename, false);
    }
    for (const field of collection.fields)
      if (field.type === "reference") {
        assert.equal(field.options.value, "{fields.id}");
        assert.ok(
          config.content.some(
            (item: { name: string }) => item.name === field.options.collection,
          ),
        );
      }
  }
});
