'use client';

import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';
import type { RiskReport } from '../types';
import { FindingsList } from './FindingsList';
import { ExorcismDialog } from './ExorcismDialog';

const HouseView = dynamic(() => import('../house/HouseSvg'), {
  ssr: false,
  loading: () => <p className="house-loading" role="status">Preparing the house view…</p>,
});

export type ExplorerView = 'house' | 'list';

export function RiskExplorer({
  report,
  initialView = 'house',
}: {
  report: RiskReport;
  initialView?: ExplorerView;
}) {
  const [view, setView] = useState<ExplorerView>(initialView);
  const [exorcisePath, setExorcisePath] = useState<string | null>(null);
  const closeExorcism = useCallback(() => setExorcisePath(null), []);
  return (
    <section className="risk-explorer" aria-label="Risk report explorer">
      <div className="view-switch" role="group" aria-label="Choose report view">
        <button type="button" aria-pressed={view === 'house'} onClick={() => setView('house')}>House view</button>
        <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>List view</button>
      </div>
      <div className="risk-explorer__content">
        {view === 'house' ? <HouseView report={report} onExorcise={setExorcisePath} /> : <FindingsList report={report} onExorcise={setExorcisePath} />}
      </div>
      {exorcisePath && report.files[exorcisePath] && <ExorcismDialog report={report} file={report.files[exorcisePath]} onClose={closeExorcism} />}
    </section>
  );
}
