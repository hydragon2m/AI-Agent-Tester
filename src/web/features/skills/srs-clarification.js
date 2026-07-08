// Parse the "[CÂU HỎI LÀM RÕ]" box the SRS skill emits at the top of its markdown
// output when it still needs more info. Shared by OutputPanel (render the form)
// and main.jsx (decide whether the SRS is final enough to auto-decompose).
//
// The AI doesn't always reproduce the exact "> **[CÂU HỎI LÀM RÕ]**" formatting
// from the system prompt — in practice it also shows up as a plain "# [CÂU HỎI
// LÀM RÕ ...]" heading, with no leading ">" or "**" at all. Both the header and
// the bullet-line matching below are intentionally lenient about markdown
// decoration (bullet char, */** emphasis, colon placement) so a formatting
// variation doesn't silently make the whole clarification block invisible —
// that used to both hide the answer form AND fool the auto-decompose gate into
// treating a still-open question list as a finished SRS.
export function parseClarificationQuestions(markdownText) {
  if (typeof markdownText !== 'string') return [];

  const headerRegex = /^[ \t>#*]*\[?CÂU HỎI LÀM RÕ[^\n]*$/im;
  const headerMatch = markdownText.match(headerRegex);
  if (!headerMatch) return [];

  const afterHeader = markdownText.slice(headerMatch.index + headerMatch[0].length);
  // Stop at the next real section heading or a "---" divider — the AI often
  // appends a closing remark ("bạn vui lòng trả lời...") after a divider,
  // which must not be picked up as a bogus extra question.
  const sectionBreakIdx = afterHeader.search(/\n(?:##\s|---)/);
  const linesBlock = sectionBreakIdx === -1 ? afterHeader : afterHeader.slice(0, sectionBreakIdx);

  // Normalize each line by stripping leading '>' and whitespace
  const cleanLinesBlock = linesBlock
    .split('\n')
    .map(line => line.replace(/^[ \t>]+/g, ''))
    .join('\n');

  // Matches "- *Label*: text", "* **Label:** text", "- **Label**: text", etc.
  // Bullet must start at column 0 — nested sub-bullets (indented "Gợi ý: ..."
  // hints under a question) are intentionally not treated as separate questions.
  const questionRegex = /^[-*]\s*\*{1,2}([^*:\n]+?)(?::\*{1,2}|\*{1,2}:)\s*(.+)$/gm;
  const questions = [];
  let m;
  while ((m = questionRegex.exec(cleanLinesBlock)) !== null) {
    const label = (m[1] || 'Câu hỏi').trim();
    const text = m[2].trim();
    if (label && text) questions.push({ label, text });
  }
  return questions;
}
