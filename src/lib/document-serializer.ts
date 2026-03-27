import type { LinesDocument } from "../types/lines";

export function serializeDocument(document: LinesDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}
