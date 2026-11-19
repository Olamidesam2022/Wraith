import { createStressReport } from '../../../fixtures/stressReport';
import { RiskExplorer } from '../../../ui/RiskExplorer';

const stressReport = createStressReport();

export default function StressPreviewPage() {
  return <main className="preview-shell"><header className="preview-header"><p className="eyebrow">Generated stress fixture · 5,000 files</p><h1>Stress preview</h1><p>Five thousand file records across one hundred rooms. No GitHub data.</p></header><RiskExplorer report={stressReport} /></main>;
}
