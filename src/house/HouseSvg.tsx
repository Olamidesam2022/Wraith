'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { houseConfig } from '../config';
import { scoringConfig } from '../config';
import type { Finding, RiskKind, RiskReport } from '../types';
import { layoutRoomPaths } from './layout';
import { LanternIcon, RiskIcon } from './RiskIcon';
import { useCursorLantern } from '../motion/lantern';
import { useHouseCamera } from '../motion/camera';
import { useMotion } from '../motion/useMotion';
import { createAssemblyTimeline } from '../motion/timelines/assembly';
import { createRoomDoorTimeline } from '../motion/timelines/interaction';

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
  const [hoveredFinding, setHoveredFinding] = useState<Finding | null>(null);
  const [selectedRoomIndex, setSelectedRoomIndex] = useState<number | null>(null);
  const [interactive, setInteractive] = useState(false);
  const previousRoomIndex = useRef<number | null>(null);
  const layout = useMemo(() => layoutRoomPaths(Object.keys(report.rooms)), [report.rooms]);
  const roomLayouts = useMemo(() => new Map(layout.rooms.map((room) => [room.path, room])), [layout.rooms]);
  const findingsByRoom = useMemo(() => {
    const grouped = new Map<string, Finding[]>();
    for (const finding of report.findings) {
      const values = grouped.get(finding.room) ?? [];
      values.push(finding);
      grouped.set(finding.room, values);
    }
    return grouped;
  }, [report.findings]);
  const selectedRoom = selectedRoomIndex === null ? null : layout.rooms[selectedRoomIndex];
  const lantern = useCursorLantern();
  const camera = useHouseCamera();
  const motion = useMotion();

  useEffect(() => {
    const timer = window.setTimeout(() => setInteractive(true), houseConfig.interactiveAfterMs);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (layout.rooms.length === houseConfig.zero) return;
    const entry = createAssemblyTimeline(layout.rooms.map((room, index) => ({
      selector: `[data-room-index="${index}"]`,
                    risk: scoringConfig.scoreScale - (report.rooms[room.path]?.health ?? scoringConfig.scoreScale),
    })));
    return motion.register(entry);
  }, [layout.rooms, motion.register, report.rooms]);

  useEffect(() => {
    const nextIndex = selectedRoomIndex;
    const doorIndex = nextIndex ?? previousRoomIndex.current;
    const door = doorIndex === null ? null : document.querySelector(`[data-door-index="${doorIndex}"]`);
    const scene = document.querySelector('.house-scene');
    if (door && scene) {
      const entry = createRoomDoorTimeline(door, scene, nextIndex !== null);
      const unregister = motion.register(entry);
      previousRoomIndex.current = nextIndex;
      return unregister;
    }
    previousRoomIndex.current = nextIndex;
    return undefined;
  }, [motion.register, selectedRoomIndex]);

  useEffect(() => {
    if (selectedRoomIndex === null) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedRoomIndex(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedRoomIndex]);

  return (
    <section className="house-view" aria-label="Repository house view">
      <div className="house-legend" aria-label="House legend">
        <span><RiskIcon kind="ghost" tone="bronze" /> Ghost · silent owner, active dependents</span>
        <span><RiskIcon kind="cobweb" tone="bronze" /> Cobweb · stale file</span>
        <span><RiskIcon kind="poltergeist" tone="bronze" /> Poltergeist · repeated fixes</span>
        <span><LanternIcon /> Lantern · room health</span>
      </div>

      <div
        className="house-scroll-frame"
        {...(interactive ? camera.handlers : {})}
        tabIndex={interactive ? 0 : -1}
        aria-busy={!interactive}
        aria-label="Use arrow keys to pan, plus and minus to zoom, R to reset. Drag to pan and use the wheel to zoom."
      >
        <svg
          className="house-svg"
          style={camera.style}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          role="group"
          aria-label={`House map with ${layout.rooms.length} rooms and ${report.findings.length} findings`}
          preserveAspectRatio="xMidYMid meet"
        >
          {layout.rooms.length === houseConfig.zero ? (
            <text className="house-empty" x="50%" y="50%" textAnchor="middle">No rooms in this report.</text>
          ) : <>
            <g className="house-scene">
            <path
              className="house-outline"
              d={`M ${houseConfig.outerPadding / 2} ${houseConfig.outerPadding + houseConfig.roofHeight} L ${layout.width / 2} ${houseConfig.outerPadding / 2} L ${layout.width - houseConfig.outerPadding / 2} ${houseConfig.outerPadding + houseConfig.roofHeight} V ${layout.height - houseConfig.outerPadding} H ${houseConfig.outerPadding / 2} Z`}
            />
            {layout.rooms.map((room, index) => {
            const health = report.rooms[room.path];
            const roomFindings = findingsByRoom.get(room.path) ?? [];
            const tone = roomTone(health.health);
            return (
              <g
                key={room.path}
                data-room-path={room.path}
                data-room-index={index}
                className={`house-room house-room--${tone}${selectedRoomIndex === index ? ' is-open' : ''}`}
                role="group"
                tabIndex={interactive ? 0 : -1}
                aria-label={`Room ${room.path}, health ${Math.round(health.health)} percent, ${health.fileCount} files, ${roomFindings.length} findings. Press Enter to ${selectedRoomIndex === index ? 'close' : 'open'} room.`}
                onKeyDown={(event) => {
                  if (!interactive || event.target !== event.currentTarget) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedRoomIndex(selectedRoomIndex === index ? null : index);
                  }
                }}
                onClick={(event) => {
                  if (!interactive) return;
                  if ((event.target as Element).closest('.house-marker')) return;
                  setSelectedRoomIndex(selectedRoomIndex === index ? null : index);
                }}
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
                <rect
                  className="house-door"
                  data-door-index={index}
                  x={room.x + room.width - houseConfig.doorWidth - houseConfig.doorInset}
                  y={room.y + room.height - houseConfig.doorHeight - houseConfig.doorInset}
                  width={houseConfig.doorWidth}
                  height={houseConfig.doorHeight}
                  rx="3"
                />
                {health.health < houseConfig.roomRiskCutoff && (
                  <text className="house-room__condition" x={room.x + room.width - 14} y={room.y + 25} textAnchor="end">Dark room</text>
                )}
                {roomFindings.map((finding, index) => {
                  const iconSize = Math.min(houseConfig.markerMaxSize, houseConfig.markerBaseSize + finding.score * houseConfig.markerScoreScale);
                  const x = room.x + houseConfig.markerStartX + (index % houseConfig.markerColumns) * houseConfig.markerGapX;
                  const y = room.y + houseConfig.markerStartY + Math.floor(index / houseConfig.markerColumns) * houseConfig.markerGapY;
                  const label = `${kindLabel[finding.kind]}: ${finding.path}, risk score ${finding.score}`;
                  const active = (hoveredFinding ?? selectedFinding)?.path === finding.path && (hoveredFinding ?? selectedFinding)?.kind === finding.kind;
                  const dependents = finding.kind === 'ghost' ? report.files[finding.path]?.dependents ?? [] : [];
                  return (
                    <g
                      key={`${finding.kind}:${finding.path}`}
                      className={`house-marker house-marker--${finding.kind}${selectedFinding?.path === finding.path && selectedFinding.kind === finding.kind ? ' is-selected' : ''}`}
                      role="button"
                      tabIndex={interactive ? 0 : -1}
                      aria-disabled={!interactive}
                      aria-label={label}
                      aria-pressed={selectedFinding?.path === finding.path && selectedFinding.kind === finding.kind}
                      onClick={() => { if (interactive) setSelectedFinding(finding); }}
                      onMouseEnter={() => setHoveredFinding(finding)}
                      onMouseLeave={() => setHoveredFinding(null)}
                      onFocus={() => setHoveredFinding(finding)}
                      onBlur={() => setHoveredFinding(null)}
                      onKeyDown={(event) => handleKeyboardAction(event, () => setSelectedFinding(finding))}
                    >
                      <title>{label}</title>
                      {dependents.map((dependentPath) => {
                        const dependentRisk = report.files[dependentPath];
                        const targetRoom = dependentRisk ? roomLayouts.get(dependentRisk.room) : undefined;
                        if (!targetRoom) return null;
                        const startX = x + iconSize / 2;
                        const startY = y + iconSize / 2;
                        const targetX = targetRoom.x + houseConfig.markerStartX;
                        const targetY = targetRoom.y + houseConfig.roomMarkerAnchorY;
                        const activeClass = active ? ' is-active' : '';
                        return (
                          <g key={`dependency:${dependentPath}`} className={`house-dependency${activeClass}`} aria-hidden="true">
                            <path
                              className="house-dependency__line"
                              d={`M ${startX} ${startY} Q ${(startX + targetX) / 2} ${startY} ${targetX} ${targetY}`}
                              style={{ strokeDasharray: `${houseConfig.dependencyPulseDash} ${houseConfig.dependencyPulseDash}` }}
                            />
                            <circle
                              className="house-dependency__pulse"
                              cx={startX}
                              cy={startY}
                              r={houseConfig.dependencyEndpointRadius}
                              style={{ '--dependency-dx': `${targetX - startX}px`, '--dependency-dy': `${targetY - startY}px` } as React.CSSProperties}
                            />
                          </g>
                        );
                      })}
                      <RiskIcon kind={finding.kind} tone={riskTone(finding.score)} size={iconSize} x={x} y={y} />
                      <text className="house-marker__score" x={x + iconSize + 3} y={y + iconSize * 0.72}>{Math.round(finding.score)}</text>
                    </g>
                  );
                })}
              </g>
            );
            })}
            </g>
          </>}
          {lantern.active && (
            <g className="cursor-lantern-overlay" aria-hidden="true" pointerEvents="none">
              <defs>
                <mask id="cursor-lantern-mask" maskUnits="userSpaceOnUse">
                  <rect width={layout.width} height={layout.height} fill="white" />
                  <circle ref={lantern.ref} cx="0" cy="0" r={houseConfig.lanternHoleRadius} fill="black" />
                </mask>
              </defs>
              <rect width={layout.width} height={layout.height} fill="var(--soot-950)" opacity={houseConfig.lanternOverlayOpacity} mask="url(#cursor-lantern-mask)" />
            </g>
          )}
        </svg>
      </div>

      {(hoveredFinding ?? selectedFinding) && (
        <aside className="house-selection" aria-live="polite" aria-label="Selected finding">
          <RiskIcon kind={(hoveredFinding ?? selectedFinding)!.kind} tone={riskTone((hoveredFinding ?? selectedFinding)!.score)} />
          <div>
            <strong>{kindLabel[(hoveredFinding ?? selectedFinding)!.kind]} · {Math.round((hoveredFinding ?? selectedFinding)!.score)}</strong>
            <code>{(hoveredFinding ?? selectedFinding)!.path}</code>
            {(hoveredFinding ?? selectedFinding)!.kind === 'ghost' && report.files[(hoveredFinding ?? selectedFinding)!.path] && (
              <p>{report.files[(hoveredFinding ?? selectedFinding)!.path].dependents.length} dependent files still import this file.</p>
            )}
          </div>
        </aside>
      )}
      {selectedRoom && (
        <aside className="room-detail" aria-label={`Room details for ${selectedRoom.path}`}>
          <div><h2>{selectedRoom.path}</h2><p>{report.rooms[selectedRoom.path].fileCount} files · {Math.round(report.rooms[selectedRoom.path].health)}% lantern health</p></div>
          <button type="button" onClick={() => setSelectedRoomIndex(null)} aria-label={`Close ${selectedRoom.path} room`}>Close room</button>
        </aside>
      )}
    </section>
  );
}
