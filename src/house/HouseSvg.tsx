'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
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
import { motionTokens } from '../motion/tokens';
import { PhysicsLayer, usePhysicsWorld } from '../motion/physicsLayer';

interface HouseSvgProps { report: RiskReport; onExorcise?: (path: string) => void; initialFindingPath?: string; initialRoomPath?: string }

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

export default function HouseSvg({ report, onExorcise, initialFindingPath, initialRoomPath }: HouseSvgProps) {
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(() => report.findings.find((item) => item.path === initialFindingPath) ?? null);
  const [hoveredFinding, setHoveredFinding] = useState<Finding | null>(null);
  const [selectedRoomIndex, setSelectedRoomIndex] = useState<number | null>(() => {
    const paths = layoutRoomPaths(Object.keys(report.rooms)).rooms;
    const index = paths.findIndex((room) => room.path === initialRoomPath);
    return index >= 0 ? index : null;
  });
  const [interactive, setInteractive] = useState(false);
  const [intensity, setIntensity] = useState(1);
  const [effectFlags, setEffectFlags] = useState({ physics: true, ghosts: true, atmosphere: true, storm: false });
  const [longEffect, setLongEffect] = useState<'earthquake' | 'replay' | 'collapse' | 'wrecking-ball' | null>(null);
  const [brokenRoomIndex, setBrokenRoomIndex] = useState<number | null>(null);
  const [gravityOn, setGravityOn] = useState(false);
  const [tornFindings, setTornFindings] = useState<Set<string>>(() => new Set());
  const [possessedPath, setPossessedPath] = useState<string | null>(null);
  const [jumpedFindingPath, setJumpedFindingPath] = useState<string | null>(null);
  const possessionTimer = useRef<number | null>(null);
  const jumpTimer = useRef<number | null>(null);
  const effectTimer = useRef<number | null>(null);
  const dragStart = useRef<{ x: number; y: number; path: string } | null>(null);
  const houseFrame = useRef<HTMLDivElement>(null);
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
  const physics = usePhysicsWorld();
  const calmMode = motion.reducedMotion || intensity === 0;
  const physicsActive = effectFlags.physics || effectFlags.atmosphere || longEffect !== null;

  useEffect(() => { motion.setCalmMode(calmMode); }, [calmMode, motion.setCalmMode]);

  const loadPhysics = async () => physics.load();
  const physicsPoint = (clientX: number, clientY: number) => {
    const rect = houseFrame.current?.getBoundingClientRect();
    return rect ? { x: clientX - rect.left, y: clientY - rect.top, width: rect.width, height: rect.height } : null;
  };
  const triggerPlay = async (effect: typeof longEffect) => {
    setLongEffect(effect);
    if (effectTimer.current !== null) window.clearTimeout(effectTimer.current);
    effectTimer.current = window.setTimeout(() => setLongEffect(null), effect === 'replay' ? motionTokens.duration.set * 3 : motionTokens.duration.set);
    const world = await loadPhysics();
    const rect = houseFrame.current?.getBoundingClientRect();
    if (!rect) return;
    const multiplier = intensity === 2 ? 1.5 : 1;
    if (effect === 'earthquake') { world.spawnParticles('dust', rect.width / 2, 0, Math.min(60, Math.floor(36 * multiplier)), multiplier); world.spawn('chunk', rect.width / 2, 12, Math.floor(12 * multiplier), multiplier); }
    if (effect === 'collapse') { const count = Math.min(15, Math.max(8, 8 + intensity * 3)); world.spawn('chunk', rect.width / 2, rect.height / 3, count, multiplier); }
    if (effect === 'wrecking-ball') { world.throwBody('chunk', rect.width / 2, 20, rect.width * 0.45, 0); world.spawn('chunk', rect.width / 2, rect.height / 3, 12, multiplier); }
  };
  const toggleGravity = async () => {
    const world = await loadPhysics();
    const next = !gravityOn;
    setGravityOn(next);
    world.setGravity(next);
    if (!next) { world.clear(); return; }
    const frame = houseFrame.current?.getBoundingClientRect();
    if (!frame) return;
    for (const finding of report.findings.filter((item) => item.kind === 'ghost').slice(0, 100)) {
      const marker = document.querySelector<SVGGElement>(`[aria-label^="Ghost: ${CSS.escape(finding.path)}"]`);
      const box = marker?.getBoundingClientRect();
      if (box) world.spawn('ghost', box.left - frame.left + box.width / 2, box.top - frame.top + box.height / 2, 1, intensity === 2 ? 1.5 : 1);
    }
  };
  const skipEffects = () => {
    setLongEffect(null); setPossessedPath(null); setBrokenRoomIndex(null);
    if (effectTimer.current !== null) window.clearTimeout(effectTimer.current);
    physics.world?.skip(); motion.skip();
  };

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
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (longEffect || possessedPath || brokenRoomIndex !== null) skipEffects();
      else if (selectedRoomIndex !== null) setSelectedRoomIndex(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [brokenRoomIndex, longEffect, possessedPath, selectedRoomIndex]);

  useEffect(() => () => {
    if (effectTimer.current !== null) window.clearTimeout(effectTimer.current);
    if (possessionTimer.current !== null) window.clearTimeout(possessionTimer.current);
    if (jumpTimer.current !== null) window.clearTimeout(jumpTimer.current);
  }, []);

  return (
    <section className={`house-view${calmMode ? ' is-calm' : ''}`} data-intensity={intensity} aria-label="Repository house view">
      <details className="house-effects-menu">
        <summary>Effects <span>{calmMode ? 'Calm' : intensity === 2 ? 'Wild' : 'Normal'}</span></summary>
        <div className="house-effects-controls">
          <label htmlFor="effect-intensity">Intensity <span>{motion.reducedMotion ? 'Calm, forced by reduced motion' : ['Calm', 'Normal', 'Wild'][intensity]}</span></label>
          <input id="effect-intensity" type="range" min="0" max="2" step="1" value={motion.reducedMotion ? 0 : intensity} onChange={(event) => setIntensity(Number(event.target.value))} aria-valuetext={motion.reducedMotion ? 'Calm, forced by reduced motion' : ['Calm', 'Normal', 'Wild'][intensity]} />
          <div className="effects-toggles">
            <label><input type="checkbox" checked={effectFlags.physics} onChange={(event) => setEffectFlags((value) => ({ ...value, physics: event.target.checked }))} /> Physics and throws</label>
            <label><input type="checkbox" checked={effectFlags.ghosts} onChange={(event) => setEffectFlags((value) => ({ ...value, ghosts: event.target.checked }))} /> Playful ghosts</label>
            <label><input type="checkbox" checked={effectFlags.atmosphere} onChange={(event) => { setEffectFlags((value) => ({ ...value, atmosphere: event.target.checked })); if (!event.target.checked) physics.world?.clearKind('dust'); }} /> Dust and fog</label>
            <label><input type="checkbox" checked={effectFlags.storm} onChange={(event) => { const enabled = event.target.checked; setEffectFlags((value) => ({ ...value, storm: enabled })); if (enabled) void loadPhysics().then((world) => { const rect = houseFrame.current?.getBoundingClientRect(); if (rect) world.spawnParticles('rain', rect.width / 2, 0, 40, intensity === 2 ? 1.5 : 1); }); else physics.world?.clearKind('rain'); }} /> Storm and rain</label>
          </div>
          <div className="effects-actions" aria-label="House effects">
            <button type="button" disabled={calmMode} onClick={() => void triggerPlay('earthquake')}>Earthquake</button>
            <button type="button" disabled={calmMode || !effectFlags.physics} aria-pressed={gravityOn} onClick={() => void toggleGravity()}>Gravity {gravityOn ? 'on' : 'off'}</button>
            <button type="button" disabled={calmMode} onClick={() => void triggerPlay('replay')}>Replay history</button>
            <button type="button" disabled={calmMode || layout.rooms.length === 0} onClick={() => { const worst = layout.rooms.reduce((best, room, index) => report.rooms[room.path].health < report.rooms[layout.rooms[best].path].health ? index : best, 0); setBrokenRoomIndex(worst); void triggerPlay('collapse'); }}>Break worst room</button>
            <button type="button" disabled={calmMode} onClick={() => void triggerPlay('wrecking-ball')}>Wrecking ball</button>
            <button type="button" onClick={camera.reset}>Reset camera (R)</button>
            {(longEffect || brokenRoomIndex !== null) && <button type="button" onClick={skipEffects}>Skip / rebuild (Esc)</button>}
            <button type="button" onClick={() => { physics.world?.clear(); physics.world?.setGravity(false); setBrokenRoomIndex(null); setLongEffect(null); setGravityOn(false); setTornFindings(new Set()); setPossessedPath(null); setEffectFlags({ physics: true, ghosts: true, atmosphere: true, storm: false }); }}>Reset effects</button>
          </div>
          <p className="effects-quality" aria-live="polite">Physics caps: 150 bodies and 300 particles · quality {Math.round((physics.world?.quality ?? 1) * 100)}%</p>
        </div>
      </details>
      <div className="house-legend" aria-label="House legend">
        <span><RiskIcon kind="ghost" tone="bronze" /> Ghost · silent owner, active dependents</span>
        <span><RiskIcon kind="cobweb" tone="bronze" /> Cobweb · stale file</span>
        <span><RiskIcon kind="poltergeist" tone="bronze" /> Poltergeist · repeated fixes</span>
        <span><LanternIcon /> Lantern · room health</span>
      </div>

      <div
        ref={houseFrame}
        className="house-scroll-frame"
        {...(interactive ? camera.handlers : {})}
        tabIndex={interactive ? 0 : -1}
        aria-busy={!interactive}
        aria-label="Use arrow keys to pan, plus and minus to zoom, R to reset. Drag to pan and use the wheel to zoom."
      >
        <svg
          className={`house-svg${calmMode ? ' is-calm' : ''}${longEffect === 'earthquake' || longEffect === 'wrecking-ball' ? ' is-shaking' : ''}${longEffect === 'replay' ? ' is-replaying' : ''}${effectFlags.storm ? ' is-stormy' : ''}${effectFlags.atmosphere && !calmMode ? ' has-fog' : ''}`}
          style={camera.style}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          role="group"
          aria-label={`House map with ${layout.rooms.length} rooms and ${report.findings.length} findings`}
          preserveAspectRatio="xMidYMid meet"
        >
          {layout.rooms.length === houseConfig.zero ? (
            <text className="house-empty" x="50%" y="50%" textAnchor="middle">No rooms in this report.</text>
          ) : <>
            <g className={`house-scene${calmMode ? ' is-calm' : ''}`}>
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
                className={`house-room house-room--${tone}${selectedRoomIndex === index ? ' is-open' : ''}${roomFindings.some((f) => f.kind === 'poltergeist') && effectFlags.ghosts && !calmMode ? ' is-poltergeist' : ''}${brokenRoomIndex === index ? ' is-broken' : ''}${longEffect === 'replay' ? ' is-replaying' : ''}`}
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
                      className={`house-marker house-marker--${finding.kind}${selectedFinding?.path === finding.path && selectedFinding.kind === finding.kind ? ' is-selected' : ''}${effectFlags.ghosts && !calmMode && finding.kind === 'ghost' ? ' is-playful' : ''}${finding.score >= houseConfig.markerHighRiskCutoff && !calmMode ? ' is-rattling' : ''}${possessedPath === finding.path ? ' is-possessed' : ''}${jumpedFindingPath === finding.path ? ' is-jumping' : ''}${tornFindings.has(`${finding.kind}:${finding.path}`) ? ' is-torn' : ''}`}
                      role="button"
                      tabIndex={interactive ? 0 : -1}
                      aria-disabled={!interactive}
                      aria-label={label}
                      aria-pressed={selectedFinding?.path === finding.path && selectedFinding.kind === finding.kind}
                      onClick={(event) => {
                        if (!interactive) return;
                        setSelectedFinding(finding);
                        if (finding.kind === 'ghost' && !calmMode) { setJumpedFindingPath(finding.path); if (jumpTimer.current !== null) window.clearTimeout(jumpTimer.current); jumpTimer.current = window.setTimeout(() => setJumpedFindingPath(null), motionTokens.duration.set); }
                        const point = physicsPoint(event.clientX, event.clientY);
                        if (finding.kind === 'cobweb') {
                          setTornFindings((values) => new Set(values).add(`${finding.kind}:${finding.path}`));
                          if (point) void loadPhysics().then((world) => world.spawnParticles('ember', point.x, point.y, 18, intensity === 2 ? 1.5 : 1));
                        } else if (finding.kind === 'ghost' && point && effectFlags.physics && !calmMode) {
                          void loadPhysics().then((world) => world.spawn('ghost', point.x, point.y, 1, intensity === 2 ? 1.5 : 1));
                        }
                      }}
                      onPointerDown={(event: PointerEvent<SVGGElement>) => {
                        if (!interactive || calmMode || !effectFlags.physics || finding.kind !== 'ghost') return;
                        event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
                        dragStart.current = { x: event.clientX, y: event.clientY, path: finding.path };
                      }}
                      onPointerUp={(event: PointerEvent<SVGGElement>) => {
                        const start = dragStart.current; dragStart.current = null;
                        if (!start || calmMode || !effectFlags.physics) return;
                        const point = physicsPoint(event.clientX, event.clientY);
                        if (point && Math.abs(event.clientX - start.x) + Math.abs(event.clientY - start.y) > 8) void loadPhysics().then((world) => world.throwBody('ghost', point.x, point.y, (event.clientX - start.x) * 5, (event.clientY - start.y) * 5));
                      }}
                      onMouseEnter={() => {
                        if (!interactive) return;
                        setHoveredFinding(finding);
                        if (finding.kind === 'ghost' && !calmMode) possessionTimer.current = window.setTimeout(() => setPossessedPath(finding.path), motionTokens.duration.set + motionTokens.duration.slow * 2);
                      }}
                      onMouseLeave={() => { setHoveredFinding(null); if (possessionTimer.current !== null) window.clearTimeout(possessionTimer.current); setPossessedPath(null); }}
                      onFocus={() => { if (interactive) setHoveredFinding(finding); }}
                      onBlur={() => { setHoveredFinding(null); setPossessedPath(null); }}
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
                  <rect width={layout.width} height={layout.height} fill="var(--bone-100)" />
                  <circle ref={lantern.ref} cx="0" cy="0" r={houseConfig.lanternHoleRadius} fill="var(--soot-950)" />
                </mask>
              </defs>
              <rect width={layout.width} height={layout.height} fill="var(--soot-950)" opacity={houseConfig.lanternOverlayOpacity} mask="url(#cursor-lantern-mask)" />
            </g>
          )}
          {!calmMode && <g className="house-bats" aria-hidden="true"><path className="house-bat" d="M0 8Q8 0 16 8Q24 0 32 8L26 18L16 12L6 18Z" /><path className="house-bat house-bat--two" d="M0 8Q8 0 16 8Q24 0 32 8L26 18L16 12L6 18Z" /><path className="house-bat house-bat--three" d="M0 8Q8 0 16 8Q24 0 32 8L26 18L16 12L6 18Z" /></g>}
        </svg>
        <PhysicsLayer world={physics.world} active={physicsActive && !calmMode} ambient={effectFlags.atmosphere && !calmMode} />
      </div>

      {(hoveredFinding ?? selectedFinding) && (
        <aside className="house-selection" aria-live="polite" aria-label="Selected finding">
          <RiskIcon kind={(hoveredFinding ?? selectedFinding)!.kind} tone={riskTone((hoveredFinding ?? selectedFinding)!.score)} />
          <div>
            <strong className={possessedPath === (hoveredFinding ?? selectedFinding)!.path ? 'is-possessed-label' : ''}>{possessedPath === (hoveredFinding ?? selectedFinding)!.path ? 'Possessed!' : `${kindLabel[(hoveredFinding ?? selectedFinding)!.kind]} · ${Math.round((hoveredFinding ?? selectedFinding)!.score)}`}</strong>
            <code>{(hoveredFinding ?? selectedFinding)!.path}</code>
            {(hoveredFinding ?? selectedFinding)!.kind === 'ghost' && report.files[(hoveredFinding ?? selectedFinding)!.path] && (
              <p>{report.files[(hoveredFinding ?? selectedFinding)!.path].dependents.length} dependent files still import this file.</p>
            )}
            {(hoveredFinding ?? selectedFinding)!.kind === 'ghost' && onExorcise && <button type="button" onClick={() => onExorcise((hoveredFinding ?? selectedFinding)!.path)}>Create exorcism plan</button>}
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
