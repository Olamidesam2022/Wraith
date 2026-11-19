import { houseConfig, scoringConfig } from '../config';
import type { Finding, RiskKind, RiskReport } from '../types';
import { RiskIcon } from '../house/RiskIcon';

export type FindingSort = 'risk-desc' | 'risk-asc' | 'path';

const labels: Record<RiskKind, string> = { ghost: 'Ghost', cobweb: 'Cobweb', poltergeist: 'Poltergeist' };

function comparePath(left: string, right: string): number {
  return left < right ? -scoringConfig.one : left > right ? scoringConfig.one : scoringConfig.zero;
}

export function sortFindings(findings: readonly Finding[], sort: FindingSort): Finding[] {
  return [...findings].sort((left, right) => {
    if (sort === 'risk-desc' && left.score !== right.score) return right.score - left.score;
    if (sort === 'risk-asc' && left.score !== right.score) return left.score - right.score;
    const pathOrder = comparePath(left.path, right.path);
    if (pathOrder !== scoringConfig.zero) return pathOrder;
    return scoringConfig.riskKindOrder.indexOf(left.kind) - scoringConfig.riskKindOrder.indexOf(right.kind);
  });
}

export function FindingsList({ report, sort = 'risk-desc' }: { report: RiskReport; sort?: FindingSort }) {
  const findings = sortFindings(report.findings, sort);
  return (
    <section className="findings-list" aria-label="Repository findings">
      <div className="findings-list__toolbar">
        <div>
          <h2>Findings</h2>
          <p>{findings.length} risk signals across {Object.keys(report.rooms).length} rooms.</p>
        </div>
        <form action="/house-preview" className="findings-list__sort">
          <input type="hidden" name="view" value="list" />
          <label htmlFor="finding-sort">Sort by</label>
          <select id="finding-sort" name="sort" defaultValue={sort}>
            <option value="risk-desc">Highest risk</option>
            <option value="risk-asc">Lowest risk</option>
            <option value="path">File path</option>
          </select>
          <button type="submit">Apply</button>
        </form>
      </div>
      {findings.length === scoringConfig.zero ? (
        <p className="findings-list__empty">No findings meet the risk thresholds.</p>
      ) : (
        <div className="findings-table-scroll">
          <table>
            <caption className="visually-hidden">Risk findings sorted by {sort.replace('-', ' ')}</caption>
            <thead><tr><th scope="col">Risk</th><th scope="col">File</th><th scope="col">Room</th><th scope="col">Score</th></tr></thead>
            <tbody>
              {findings.map((finding) => (
                <tr key={`${finding.kind}:${finding.path}`} data-testid="finding-row" data-finding-key={`${finding.kind}:${finding.path}`}>
                  <td>
                    <span className={`finding-kind finding-kind--${finding.kind}`}>
                      <RiskIcon kind={finding.kind} tone={finding.score >= houseConfig.markerHighRiskCutoff ? 'umber' : finding.score >= houseConfig.markerMediumRiskCutoff ? 'oxblood' : 'bronze'} />
                      <span>{labels[finding.kind]}</span>
                    </span>
                  </td>
                  <td><code>{finding.path}</code></td>
                  <td><code>{finding.room}</code></td>
                  <td><span className="finding-score">{Math.round(finding.score)} / 100</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
