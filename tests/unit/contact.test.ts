import assert from "node:assert/strict";
import { test } from "node:test";
import { contactLinks, contactSchema, getContact } from "../../lib/contact";
test("published contact file is valid and empty channels render no links", () => {
  const contact = getContact();
  assert.deepEqual(contactLinks(contactSchema.parse({}), "Olá"), []);
  assert.equal(
    contactLinks(contact, "Olá").length,
    Object.values(contact).filter(Boolean).length,
  );
});
test("configured channels build WhatsApp, e-mail and Instagram links with context", () => {
  const links = contactLinks(
    contactSchema.parse({
      whatsapp: "5511999999999",
      email: "contato@example.com",
      instagram: "cura.cafe",
    }),
    "Quero saber do SAMBA (lote CURA-26-01).",
  );
  assert.deepEqual(
    links.map((link) => link.href),
    [
      "https://wa.me/5511999999999?text=Quero%20saber%20do%20SAMBA%20(lote%20CURA-26-01).",
      "mailto:contato@example.com?subject=Quero%20saber%20do%20SAMBA%20(lote%20CURA-26-01).",
      "https://www.instagram.com/cura.cafe/",
    ],
  );
});
test("malformed channels fail content validation instead of publishing broken links", () => {
  for (const value of [
    { whatsapp: "(11) 99999-9999" },
    { whatsapp: "11999999999" },
    { email: "contato" },
    { instagram: "@cura.cafe" },
    { instagram: "https://instagram.com/cura" },
    { phone: "5511999999999" },
  ])
    assert.equal(contactSchema.safeParse(value).success, false);
});
