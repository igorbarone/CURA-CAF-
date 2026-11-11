// Barista replies are shown as plain text. If a model reply still carries
// light markdown, "**negrito**" becomes a bold segment and stray markers
// (headings, list bullets, lone asterisks/underscores) are removed. The UI
// renders segments as React text, never as HTML, so nothing is injected.
export type ReplySegment = { text: string; bold: boolean };

export function formatReply(text: string): ReplySegment[] {
  const clean = text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[*-]\s+/gm, "• ")
    .replace(/__(.+?)__/g, "$1");
  return clean
    .split(/\*\*(.+?)\*\*/g)
    .map((part, index) => ({
      text: index % 2 === 1 ? part : part.replace(/\*/g, ""),
      bold: index % 2 === 1,
    }))
    .filter((segment) => segment.text.length > 0);
}
