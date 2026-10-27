import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
// Real commercial channels, filled by the team in the CMS. Empty means the
// channel does not exist yet and no contact link is rendered anywhere.
const optional = (pattern: RegExp, message: string) =>
  z.string().trim().regex(pattern, message).or(z.literal("")).default("");
export const contactSchema = z
  .object({
    whatsapp: optional(
      /^55\d{10,11}$/,
      "WhatsApp: use 55 + DDD + número, só dígitos (ex.: 5511999999999)",
    ),
    email: optional(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "E-mail inválido"),
    instagram: optional(
      /^[A-Za-z0-9._]{1,30}$/,
      "Instagram: informe só o usuário, sem @ ou link",
    ),
  })
  .strict();
export type Contact = z.infer<typeof contactSchema>;
export type ContactLink = { kind: string; label: string; href: string };
export function getContact(
  root = process.env.CURA_CONTENT_ROOT ?? process.cwd(),
): Contact {
  const file = join(root, "content/contact.json");
  return contactSchema.parse(
    existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {},
  );
}
// `message` pre-fills WhatsApp and the e-mail subject with the visitor's context.
export function contactLinks(contact: Contact, message: string): ContactLink[] {
  return [
    contact.whatsapp && {
      kind: "whatsapp",
      label: "Conversar no WhatsApp",
      href: `https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(message)}`,
    },
    contact.email && {
      kind: "email",
      label: "Enviar e-mail",
      href: `mailto:${contact.email}?subject=${encodeURIComponent(message)}`,
    },
    contact.instagram && {
      kind: "instagram",
      label: `Instagram @${contact.instagram}`,
      href: `https://www.instagram.com/${contact.instagram}/`,
    },
  ].filter((link): link is ContactLink => !!link);
}
