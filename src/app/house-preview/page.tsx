import { housePreviewReport } from '../../fixtures/houseReport';
import { RiskExplorer, type ExplorerView } from '../../ui/RiskExplorer';

interface PreviewSearchParams { view?: string }

export default async function HousePreviewPage({ searchParams }: { searchParams: Promise<PreviewSearchParams> }) {
  const params = await searchParams;
  const initialView: ExplorerView = params.view === 'list' ? 'list' : 'house';
  return (
    <main className="preview-shell">
      <header className="preview-header">
        <p className="eyebrow">Static renderer preview · {housePreviewReport.repoName}</p>
        <h1>A house with a history</h1>
        <p>40 fixture files, scored from commit history and dependency edges.</p>
      </header>
      <RiskExplorer
        report={housePreviewReport}
        initialView={initialView}
      />
    </main>
  );
}
