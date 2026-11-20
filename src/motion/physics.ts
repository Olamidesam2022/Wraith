import type { MotionEffect } from './masterClock';

export const physicsCaps = { bodies: 150, particles: 300, ambient: 60 } as const;
export type PhysicsKind = 'ghost' | 'chunk' | 'ember' | 'dust' | 'bat' | 'rain';
export interface PhysicsBody { id: number; kind: PhysicsKind; x: number; y: number; vx: number; vy: number; radius: number; life: number; rotation: number; spin: number; squash: number }

export class PhysicsWorld implements MotionEffect {
  private bodies: PhysicsBody[] = [];
  private particles: PhysicsBody[] = [];
  private nextId = 1;
  private gravity = 980;
  private paused = false;
  private calm = false;
  private poorFrames = 0;
  private goodFrames = 0;
  quality = 1;
  heavyEffectsEnabled = true;

  get activeBodies(): readonly PhysicsBody[] { return this.bodies; }
  get activeParticles(): readonly PhysicsBody[] { return this.particles; }
  get particleCount(): number { return this.particles.length; }

  private make(kind: PhysicsKind, x: number, y: number, vx: number, vy: number, radius: number, life: number, spin = 0): PhysicsBody {
    return { id: this.nextId++, kind, x, y, vx, vy, radius, life, rotation: 0, spin, squash: 0 };
  }

  spawn(kind: PhysicsKind, x: number, y: number, count: number, force = 1): number {
    if (this.calm || this.paused) return 0;
    const cap = Math.max(1, Math.floor(physicsCaps.bodies * this.quality));
    const amount = Math.min(Math.max(0, Math.floor(count)), cap - this.bodies.length);
    for (let i = 0; i < amount; i += 1) {
      const angle = (Math.PI * 2 * i) / Math.max(1, amount) + (i % 3) * 0.2;
      const speed = (100 + (i % 7) * 24) * force;
      this.bodies.push(this.make(kind, x, y, Math.cos(angle) * speed, -Math.abs(Math.sin(angle) * speed) - 60, kind === 'chunk' ? 5 + i % 6 : 9, 8, (i % 2 ? 1 : -1) * (2 + i % 4)));
    }
    return amount;
  }

  throwBody(kind: PhysicsKind, x: number, y: number, vx: number, vy: number): void {
    if (this.calm || this.paused || this.bodies.length >= Math.floor(physicsCaps.bodies * this.quality)) return;
    this.bodies.push(this.make(kind, x, y, Math.max(-1_200, Math.min(1_200, vx)), Math.max(-1_200, Math.min(1_200, vy)), 10, 12, vx / 50));
  }

  spawnParticles(kind: PhysicsKind, x: number, y: number, count: number, force = 1): number {
    if (this.calm || this.paused) return 0;
    const cap = Math.min(physicsCaps.particles, Math.floor(physicsCaps.particles * this.quality));
    const amount = Math.min(Math.max(0, Math.floor(count)), cap - this.particles.length);
    for (let i = 0; i < amount; i += 1) {
      const angle = ((Math.PI * 2) * i) / Math.max(1, amount);
      const speed = (25 + (i % 11) * 8) * force;
      this.particles.push(this.make(kind, x, y, Math.cos(angle) * speed, Math.sin(angle) * speed - 30, 1 + i % 3, 0.8 + (i % 9) / 10, (i % 2 ? 1 : -1) * 5));
    }
    return amount;
  }

  seedAmbient(width: number, height: number): void {
    const cap = Math.min(physicsCaps.ambient, Math.floor(physicsCaps.ambient * this.quality));
    while (!this.calm && this.particles.length < cap) {
      const index = this.particles.length;
      this.particles.push(this.make('dust', (index * 73) % Math.max(1, width), (index * 137) % Math.max(1, height), ((index % 5) - 2) * 4, 4 + index % 8, 1 + index % 2, 1_000));
    }
  }

  setGravity(enabled: boolean): void { this.gravity = enabled ? 980 : 0; }
  clear(): void { this.bodies = []; this.particles = []; }
  clearKind(kind: PhysicsKind): void { this.particles = this.particles.filter((particle) => particle.kind !== kind); this.bodies = this.bodies.filter((body) => body.kind !== kind); }

  step(deltaMs: number, width: number, height: number): void {
    if (this.paused || this.calm) return;
    if (deltaMs > 16) { this.poorFrames += 1; this.goodFrames = 0; }
    else if (deltaMs < 12) { this.goodFrames += 1; this.poorFrames = Math.max(0, this.poorFrames - 1); }
    if (this.poorFrames >= 12) {
      this.quality = Math.max(0.25, this.quality * 0.8);
      this.heavyEffectsEnabled = this.quality > 0.4;
      this.poorFrames = 0;
      this.particles.length = Math.min(this.particles.length, Math.floor(physicsCaps.particles * this.quality));
      this.bodies.length = Math.min(this.bodies.length, Math.floor(physicsCaps.bodies * this.quality));
    } else if (this.goodFrames >= 120 && this.quality < 1) {
      this.quality = Math.min(1, this.quality + 0.05);
      this.heavyEffectsEnabled = this.quality > 0.4;
      this.goodFrames = 0;
    }
    const dt = Math.min(0.032, deltaMs / 1_000);
    for (const body of this.bodies) {
      body.vy += this.gravity * dt;
      body.x += body.vx * dt;
      body.y += body.vy * dt;
      body.rotation += body.spin * dt;
      if (body.x < body.radius || body.x > width - body.radius) { body.x = Math.max(body.radius, Math.min(width - body.radius, body.x)); body.vx *= -0.72; body.spin *= -0.8; }
      if (body.y > height - body.radius) { body.y = height - body.radius; if (Math.abs(body.vy) > 48) body.squash = Math.min(1, Math.abs(body.vy) / 600); body.vy *= -0.64; body.vx *= 0.82; body.spin *= 0.8; if (Math.abs(body.vy) < 18) body.vy = 0; }
      body.squash = Math.max(0, body.squash - dt * 2.8);
      body.life -= dt;
    }
    for (let i = 0; i < this.bodies.length; i += 1) for (let j = i + 1; j < this.bodies.length; j += 1) {
      const a = this.bodies[i], b = this.bodies[j];
      const dx = b.x - a.x, dy = b.y - a.y, minDistance = a.radius + b.radius;
      const distance = Math.hypot(dx, dy);
      if (distance > 0 && distance < minDistance) {
        const nx = dx / distance, ny = dy / distance;
        const overlap = (minDistance - distance) / 2;
        a.x -= nx * overlap; a.y -= ny * overlap; b.x += nx * overlap; b.y += ny * overlap;
        a.vx -= nx * 22; b.vx += nx * 22; a.vy -= ny * 12; b.vy += ny * 12;
      }
    }
    this.bodies = this.bodies.filter((body) => body.life > 0 || Math.abs(body.vx) + Math.abs(body.vy) > 3);
    for (const particle of this.particles) { particle.vy += this.gravity * dt * 0.2; particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.life -= dt; if (particle.y > height - particle.radius) { particle.y = height - particle.radius; particle.vy *= -0.48; } }
    this.particles = this.particles.filter((particle) => particle.life > 0 && particle.x > -20 && particle.x < width + 20);
  }

  setCalmMode(calm: boolean): void { this.calm = calm; if (calm) { this.clear(); this.gravity = 0; } }
  pause(): void { this.paused = true; }
  resume(): void { this.paused = false; }
  skip(): void { this.clear(); }
}
