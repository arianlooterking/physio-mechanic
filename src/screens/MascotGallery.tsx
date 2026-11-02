import { Mascot, type Mood } from '../components/Mascot';

const MOODS: Mood[] = ['idle', 'happy', 'cheer', 'wave', 'think', 'wow', 'oops', 'wink'];

/** Development only: every mood of «بیو» side by side. */
export function MascotGallery() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, padding: 32, background: 'var(--bg)' }}>
      {MOODS.map((m) => (
        <div key={m} style={{ display: 'grid', placeItems: 'center', gap: 8, padding: 16, background: 'var(--surface)', borderRadius: 20 }}>
          <Mascot mood={m} size={130} />
          <b>{m}</b>
        </div>
      ))}
    </div>
  );
}
