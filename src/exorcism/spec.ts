import { exorcismConfig } from '../config';
import type { FileRiskScores, RiskReport } from '../types';

export type ExorcismMode = 'document' | 'tests' | 'refactor';
export const modes: Record<ExorcismMode, { title: string; requirements: string[]; tasks: string[] }> = {
  document: { title: 'Document the contract', requirements: ['Preserve current runtime behavior.', 'Explain public inputs, outputs, and side effects.'], tasks: ['Trace callers and dependents.', 'Document invariants and failure cases.', 'Review the document with a maintainer.'] },
  tests: { title: 'Add focused tests', requirements: ['Tests must fail when the current contract changes.', 'Cover the highest-risk dependent paths.'], tasks: ['Identify boundary cases.', 'Add regression tests for each dependent.', 'Run the focused and full test suites.'] },
  refactor: { title: 'Refactor safely', requirements: ['Keep exported behavior stable.', 'Make one small change at a time.'], tasks: ['Map imports and callers.', 'Add characterization tests.', 'Refactor, then compare behavior.'] },
};
export function buildExorcismSpec(report: RiskReport, file: FileRiskScores, mode: ExorcismMode): string {
  const inactive = file.authors.filter((a) => !a.lastActivityAt || Date.now() - Date.parse(a.lastActivityAt) > exorcismConfig.maximumDaysForDisplay * 86_400_000).map((a) => a.login);
  const days = file.lastTouchedAt ? Math.max(0, Math.floor((Date.now() - Date.parse(file.lastTouchedAt)) / 86_400_000)) : 'unknown';
  const dependents = file.dependents.length ? file.dependents.map((p) => `- \`${p}\``).join('\n') : '- None recorded';
  const selected = modes[mode];
  return `# Exorcism plan: \`${file.path}\`\n\n## Why this file is risky\n- Ghost score: ${Math.round(file.ghostScore)} / 100\n- Last touched: ${days} days ago\n- Inactive authors: ${inactive.length ? inactive.map((x) => `\`${x}\``).join(', ') : 'none identified'}\n- Dependents: ${file.dependents.length}\n\n## Dependents\n${dependents}\n\n## Task modes\n${Object.entries(modes).map(([key, value]) => `### ${value.title}${key === mode ? ' (selected)' : ''}\nRequirements:\n${value.requirements.map((x) => `- ${x}`).join('\n')}\nTask list:\n${value.tasks.map((x) => `- [ ] ${x}`).join('\n')}`).join('\n\n')}\n\n## Suggested order of work\n1. ${selected.tasks[0]}\n2. ${selected.tasks[1]}\n3. ${selected.tasks[2]}\n\nRepository: \`${report.repoName}\`\n`;
}
export function typingDurationMs(length: number): number { return Math.min(exorcismConfig.maximumDurationMs, Math.ceil(Math.max(1, length) * exorcismConfig.baseCharacterMs)); }
