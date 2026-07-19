export interface ParsedDiffLine {
  line: string;
  oldNum: number | string;
  newNum: number | string;
  type: "header" | "hunk" | "add" | "delete" | "normal";
}

export function parseDiffLines(diffText: string): ParsedDiffLine[] {
  let oldLine = 0;
  let newLine = 0;
  const lines = diffText.split("\n");

  return lines.map((line) => {
    let oldNum: number | string = "";
    let newNum: number | string = "";
    let type: ParsedDiffLine["type"] = "normal";

    const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      oldLine = parseInt(hunkMatch[1]!, 10);
      newLine = parseInt(hunkMatch[2]!, 10);
      oldNum = "…";
      newNum = "…";
      type = "hunk";
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      newNum = newLine++;
      type = "add";
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      oldNum = oldLine++;
      type = "delete";
    } else if (
      line.startsWith("diff ") ||
      line.startsWith("index ") ||
      line.startsWith("---") ||
      line.startsWith("+++")
    ) {
      type = "header";
    } else {
      if (oldLine > 0 || newLine > 0) {
        oldNum = oldLine++;
        newNum = newLine++;
      }
    }

    return { line, oldNum, newNum, type };
  });
}
