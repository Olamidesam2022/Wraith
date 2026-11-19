import { housePreviewReport } from '../../fixtures/houseReport';
import { FindingsList, type FindingSort } from '../../ui/FindingsList';
import { RiskExplorer, type ExplorerView } from '../../ui/RiskExplorer';

interface PreviewSearchParams { view?: string; sort?: string }

export default async function HousePreviewPage({ searchParams }: { searchParams: Promise<PreviewSearchParams> }) {
  const params = await searchParams;
  const initialView: ExplorerView = params.view === 'list' ? 'list' : 'house';
  const sort: FindingSort = params.sort === 'risk-asc' || params.sort === 'path' ? params.sort : 'risk-desc';
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
        listView={<FindingsList report={housePreviewReport} sort={sort} />}
      />
    </main>
  );
}
