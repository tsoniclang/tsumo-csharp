import { Markdown } from "@tsonic/dotnet/Markdig.js";
import { HtmlAttributesExtensions } from "@tsonic/dotnet/Markdig.Renderers.Html.js";
import { ContainerBlock, HeadingBlock } from "@tsonic/dotnet/Markdig.Syntax.js";
import {
  AutolinkInline,
  CodeInline,
  ContainerInline,
  HtmlEntityInline,
  LineBreakInline,
  LiteralInline,
} from "@tsonic/dotnet/Markdig.Syntax.Inlines.js";
import type { Inline } from "@tsonic/dotnet/Markdig.Syntax.Inlines.js";
import type { int32 } from "@tsonic/core/types.js";
import { TextBuilder } from "../utils/text-builder.js";
import { markdownPipeline } from "./pipeline.js";

class TocHeading {
  level: int32;
  text: string;
  id: string;

  constructor(level: int32, text: string, id: string) {
    this.level = level;
    this.text = text;
    this.id = id;
  }
}

class TocListFrame {
  level: int32;
  liOpen: boolean;

  constructor(level: int32) {
    this.level = level;
    this.liOpen = false;
  }
}

const indent = (depth: int32): string => {
  let out = "";
  for (let i = 0; i < depth; i++) out += "  ";
  return out;
};

const appendInlinePlainText = (inline: Inline, output: TextBuilder): void => {
  if (inline instanceof LiteralInline) {
    const literal = inline as LiteralInline;
    output.append(literal.ToString());
    return;
  }

  if (inline instanceof CodeInline) {
    const code = inline as CodeInline;
    output.append(code.Content);
    return;
  }

  if (inline instanceof HtmlEntityInline) {
    const entity = inline as HtmlEntityInline;
    output.append(entity.Transcoded.ToString());
    return;
  }

  if (inline instanceof AutolinkInline) {
    const autolink = inline as AutolinkInline;
    output.append(autolink.Url);
    return;
  }

  if (inline instanceof LineBreakInline) {
    output.append(" ");
    return;
  }

  if (inline instanceof ContainerInline) {
    const container = inline as ContainerInline;
    const it = container.GetEnumerator();
    while (it.MoveNext()) appendInlinePlainText(it.Current, output);
    it.Dispose();
  }
};

const getHeadingPlainText = (heading: HeadingBlock): string => {
  const inline = heading.Inline;
  if (inline == null) return "";

  const output = new TextBuilder();
  appendInlinePlainText(inline, output);
  return output.toString();
};

// Collect headings from AST using actual Markdig-generated IDs
const collectHeadingsFromAst = (document: ContainerBlock): TocHeading[] => {
  const headings: TocHeading[] = [];
  collectHeadingsRecursive(document, headings);
  return headings;
};

const collectHeadingsRecursive = (container: ContainerBlock, headings: TocHeading[]): void => {
  const it = container.GetEnumerator();
  while (it.MoveNext()) {
    const block = it.Current;

    if (block instanceof HeadingBlock) {
      const heading = block as HeadingBlock;
      // Get the ID from Markdig's HtmlAttributes (set by AutoIdentifiers extension)
      const attrs = HtmlAttributesExtensions.TryGetAttributes(heading);
      const id = attrs?.Id ?? "";

      // Get plain text from heading content
      const text = getHeadingPlainText(heading);

      headings.push(new TocHeading(heading.Level, text, id));
    }

    // Recurse into child containers
    if (block instanceof ContainerBlock) {
      collectHeadingsRecursive(block as ContainerBlock, headings);
    }
  }
  it.Dispose();
};

export const escapeHtmlText = (text: string): string => {
  let result = text;
  result = result.replaceAll("&", "&amp;");
  result = result.replaceAll("<", "&lt;");
  result = result.replaceAll(">", "&gt;");
  result = result.replaceAll("\"", "&quot;");
  return result;
};

export const generateTableOfContents = (markdown: string): string => {
  // Parse to AST to get actual Markdig-generated IDs
  const document = Markdown.Parse(markdown, markdownPipeline);
  const headings = collectHeadingsFromAst(document);

  if (headings.length === 0) return `<nav id="TableOfContents"></nav>`;

  const output = new TextBuilder();
  output.append(`<nav id="TableOfContents">\n`);

  const listStack: TocListFrame[] = [];
  let currentLevel: int32 = 0;

  for (let i = 0; i < headings.length; i++) {
    const h = headings[i]!;

    // Clamp depth increases to avoid invalid placeholder <li> elements when headings skip levels.
    let targetLevel = h.level;
    if (currentLevel !== 0 && targetLevel > currentLevel + 1) targetLevel = currentLevel + 1;

    if (listStack.length === 0) {
      output.append(`${indent(1)}<ul>\n`);
      listStack.push(new TocListFrame(targetLevel));
      currentLevel = targetLevel;
    }

    // Move up to target level (closing lists and items as needed)
    while (listStack.length > 0 && targetLevel < currentLevel) {
      const top = listStack[listStack.length - 1]!;
      if (top.liOpen) {
        output.append(`${indent(listStack.length + 1)}</li>\n`);
        top.liOpen = false;
      }
      output.append(`${indent(listStack.length)}</ul>\n`);
      listStack.pop();
      currentLevel = listStack.length > 0 ? listStack[listStack.length - 1]!.level : 0;
    }

    if (listStack.length === 0) {
      output.append(`${indent(1)}<ul>\n`);
      listStack.push(new TocListFrame(targetLevel));
      currentLevel = targetLevel;
    }

    // Same level: close previous <li> before opening a sibling
    if (targetLevel === currentLevel) {
      const top = listStack[listStack.length - 1]!;
      if (top.liOpen) {
        output.append(`${indent(listStack.length + 1)}</li>\n`);
        top.liOpen = false;
      }
    }

    // Descend one level (if needed) by opening a nested <ul> within the current open <li>
    if (targetLevel > currentLevel) {
      output.append(`${indent(listStack.length + 1)}<ul>\n`);
      listStack.push(new TocListFrame(targetLevel));
      currentLevel = targetLevel;
    }

    output.append(`${indent(listStack.length + 1)}<li><a href="#${h.id}">${escapeHtmlText(h.text)}</a>\n`);
    listStack[listStack.length - 1]!.liOpen = true;
  }

  while (listStack.length > 0) {
    const top = listStack[listStack.length - 1]!;
    if (top.liOpen) {
      output.append(`${indent(listStack.length + 1)}</li>\n`);
      top.liOpen = false;
    }
    output.append(`${indent(listStack.length)}</ul>\n`);
    listStack.pop();
  }

  output.append(`</nav>`);
  return output.toString();
};
