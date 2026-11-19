import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="app-shell">
      <p className="eyebrow">Repository maintenance intelligence</p>
      <h1>What still depends on the people who left?</h1>
      <p>Wraith turns hidden maintenance risk into a house you can explore.</p>
      <Link className="primary-link" href="/house-preview">Preview the house fixture</Link>
    </main>
  );
}
