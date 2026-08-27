import type { ReactNode } from "react";

function inlineMd(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold) return <strong key={i}>{bold[1]}</strong>;
    return part ? <span key={i}>{part}</span> : null;
  });
}

function isListLine(line: string) {
  return /^\s*[-*]\s+/.test(line);
}

/** Small markdown subset: paragraphs, **bold**, and - / * lists. */
export function MarkdownBody({ md }: { md: string }) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    if (!lines[i].trim()) {
      i += 1;
      continue;
    }
    if (isListLine(lines[i])) {
      const items: string[] = [];
      while (i < lines.length && isListLine(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ul className="creds" key={key++}>
          {items.map((item, j) => (
            <li key={j}>{inlineMd(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !isListLine(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={key++}>{inlineMd(para.join(" "))}</p>,
    );
  }
  if (!blocks.length) return null;
  return <div className="md-body">{blocks}</div>;
}
