'use client';

import dynamic from 'next/dynamic';
import { useState, type ReactNode } from 'react';
import type { RiskReport } from '../types';

const HouseView = dynamic(() => import('../house/HouseSvg'), {
  ssr: false,
  loading: () => <p className="house-loading" role="status">Preparing the house view…</p>,
});

export type ExplorerView = 'house' | 'list';

export function RiskExplorer({
  report,
  listView,
  initialView = 'house',
}: {
  report: RiskReport;
  listView: ReactNode;
  initialView?: ExplorerView;
}) {
  const [view, setView] = useState<ExplorerView>(initialView);
  return (
    <section className="risk-explorer" aria-label="Risk report explorer">
      <div className="view-switch" role="group" aria-label="Choose report view">
        <button type="button" aria-pressed={view === 'house'} onClick={() => setView('house')}>House view</button>
        <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>List view</button>
      </div>
      <div className="risk-explorer__content">
        {view === 'house' ? <HouseView report={report} /> : listView}
      </div>
    </section>
  );
}
