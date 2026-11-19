'use client';

import { useMemo, useState, type KeyboardEvent } from 'react';
import { houseConfig } from '../config';
import type { Finding, RiskKind, RiskReport } from '../types';
import { layoutRoomPaths } from './layout';
import { LanternIcon, RiskIcon } from './RiskIcon';

interface HouseSvgProps { report: RiskReport }

const kindLabel: Record<RiskKind, string> = {
  ghost: 'Ghost',
  cobweb: 'Cobweb',
  poltergeist: 'Poltergeist',
};

function roomTone(health: number): 'bronze' | 'umber' | 'oxblood' {
  if (health < houseConfig.roomRiskCutoff) return 'umber';
  if (health < houseConfig.roomHealthyCutoff) return 'oxblood';
  return 'bronze';
}

function riskTone(score: number): 'bronze' | 'umber' | 'oxblood' {
  if (score >= houseConfig.markerHighRiskCutoff) return 'umber';
  if (score >= houseConfig.markerMediumRiskCutoff) return 'oxblood';
  return 'bronze';
}

function handleKeyboardAction(event: KeyboardEvent<SVGGElement>, action: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    action();
  }
}

export default function HouseSvg({ report }: HouseSvgProps) {
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const layout = useMemo(() => layoutRoomPaths(Object.keys(report.rooms)), [report.rooms]);
  const findingsByRoom = useMemo(() => {
    const grouped = new Map<string, Finding[]>();
    for (const finding of report.findings) {
      const values = grouped.get(finding.room) ?? [];
      values.push(finding);
      grouped.set(finding.room, values);
    }
    return grouped;
  }, [report.findings]);
  const reportFile = selectedFinding ? report.files[selectedFinding.path] : undefined;

  return (
    <section className="house-view" aria-label="Repository house view">
      <div className="house-legend" aria-label="House legend">
        <span><RiskIcon kind="ghost" tone="bronze" /> Ghost · silent owner, active dependents</span>
        <span><RiskIcon kind="cobweb" tone="bronze" /> Cobweb · stale file</span>
        <span><RiskIcon kind="poltergeist" tone="bronze" /> Poltergeist · repeated fixes</span>
        <span><LanternIcon /> Lantern · room health</span>
      </div>

      <div className="house-scroll-frame">
        <svg
          className="house-svg"
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          role="group"
          aria-label={`House map with ${layout.rooms.length} rooms and ${report.findings.length} findings`}
          preserveAspectRatio="xMidYMid meet"
        >
          {layout.rooms.length === houseConfig.zero ? (
            <text className="house-empty" x="50%" y="50%" textAnchor="middle">No rooms in this report.</text>
          ) : <>
            <path
              className="house-outline"
              d={`M ${houseConfig.outerPadding / 2} ${houseConfig.outerPadding + houseConfig.roofHeight} L ${layout.width / 2} ${houseConfig.outerPadding / 2} L ${layout.width - houseConfig.outerPadding / 2} ${houseConfig.outerPadding + houseConfig.roofHeight} V ${layout.height - houseConfig.outerPadding} H ${houseConfig.outerPadding / 2} Z`}
            />
            {layout.rooms.map((room) => {
            const health = report.rooms[room.path];
            const roomFindings = findingsByRoom.get(room.path) ?? [];
            const tone = roomTone(health.health);
            return (
              <g
                key={room.path}
                className={`house-room house-room--${tone}`}
                role="group"
                tabIndex={0}
                aria-label={`Room ${room.path}, health ${Math.round(health.health)} percent, ${health.fileCount} files, ${roomFindings.length} findings`}
              >
                <rect
                  className={`house-room__surface house-room__surface--${tone}`}
                  x={room.x}
                  y={room.y}
                  width={room.width}
                  height={room.height}
                  rx="8"
                />
                <text className="house-room__path" x={room.x + 14} y={room.y + 25}>{room.path}</text>
                <g className="house-lantern" transform={`translate(${room.x + 14} ${room.y + 32})`} aria-hidden="true">
                  <path d="M3 1h8M4 1v4L1 8v11h12V8L10 5V1M1 8h12M7 11v4" />
                </g>
                <text className="house-room__health" x={room.x + 34} y={room.y + 47}>
                  {`${Math.round(health.health)}% lantern health · ${health.fileCount} files`}
                </text>
                {health.health < houseConfig.roomRiskCutoff && (
                  <text className="house-room__condition" x={room.x + room.width - 14} y={room.y + 25} textAnchor="end">Dark room</text>
                )}
                {roomFindings.map((finding, index) => {
                  const iconSize = Math.min(houseConfig.markerMaxSize, houseConfig.markerBaseSize + finding.score * houseConfig.markerScoreScale);
                  const x = room.x + houseConfig.markerStartX + (index % houseConfig.markerColumns) * houseConfig.markerGapX;
                  const y = room.y + houseConfig.markerStartY + Math.floor(index / houseConfig.markerColumns) * houseConfig.markerGapY;
                  const label = `${kindLabel[finding.kind]}: ${finding.path}, risk score ${finding.score}`;
                  return (
                    <g
                      key={`${finding.kind}:${finding.path}`}
                      className={`house-marker house-marker--${finding.kind}${selectedFinding?.path === finding.path && selectedFinding.kind === finding.kind ? ' is-selected' : ''}`}
                      role="button"
                      tabIndex={0}
                      aria-label={label}
                      aria-pressed={selectedFinding?.path === finding.path && selectedFinding.kind === finding.kind}
                      onClick={() => setSelectedFinding(finding)}
                      onKeyDown={(event) => handleKeyboardAction(event, () => setSelectedFinding(finding))}
                    >
                      <title>{label}</title>
                      <RiskIcon kind={finding.kind} tone={riskTone(finding.score)} size={iconSize} x={x} y={y} />
                      <text className="house-marker__score" x={x + iconSize + 3} y={y + iconSize * 0.72}>{Math.round(finding.score)}</text>
                    </g>
                  );
                })}
              </g>
            );
            })}
          </>}
        </svg>
      </div>

      {selectedFinding && (
        <aside className="house-selection" aria-live="polite" aria-label="Selected finding">
          <RiskIcon kind={selectedFinding.kind} tone={riskTone(selectedFinding.score)} />
          <div>
            <strong>{kindLabel[selectedFinding.kind]} · {Math.round(selectedFinding.score)}</strong>
            <code>{selectedFinding.path}</code>
            {selectedFinding.kind === 'ghost' && reportFile && (
              <p>{reportFile.dependents.length} dependent files still import this file.</p>
            )}
          </div>
        </aside>
      )}
    </section>
  );
}
