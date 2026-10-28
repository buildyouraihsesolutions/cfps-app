import Link from 'next/link';

export default function AdminTabs({ active }: { active: 'access' | 'progress' | 'live' }) {
  return (
    <div className="seg" style={{ margin: '4px 0 16px' }}>
      <Link href="/admin" className={active === 'access' ? 'on' : ''}>Access</Link>
      <Link href="/admin/progress" className={active === 'progress' ? 'on' : ''}>Progress</Link>
      <Link href="/admin/live" className={active === 'live' ? 'on' : ''}>Live</Link>
    </div>
  );
}
