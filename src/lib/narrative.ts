import { ClickUpComment } from "./clickup";

const MAX_COMMENTS = 3;
const MAX_EXCERPT_LENGTH = 240;

function stripClickUpMarkup(text: string): string {
  return text
    .replace(/@\[.*?\]\(.*?\)/g, (m) => m.replace(/@\[(.*?)\].*/, "@$1")) // @mentions
    .replace(/[*_~`]/g, "")
    .trim();
}

// v1 progress narrative: literal excerpts of the most recent comments, no
// summarization. Stored with narrative_source = "raw_comments". An
// "AI summarize" step (Anthropic API) is a clean additive upgrade later —
// see plan section 5 — not built now.
export function buildProgressNarrative(comments: ClickUpComment[]): string {
  const recent = [...comments]
    .sort((a, b) => Number(b.date) - Number(a.date))
    .slice(0, MAX_COMMENTS);

  if (recent.length === 0) return "";

  return recent
    .map((c) => {
      const text = stripClickUpMarkup(c.comment_text);
      const excerpt = text.length > MAX_EXCERPT_LENGTH ? `${text.slice(0, MAX_EXCERPT_LENGTH)}…` : text;
      return `- ${excerpt}`;
    })
    .join("\n");
}
