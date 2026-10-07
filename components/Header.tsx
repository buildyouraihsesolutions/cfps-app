import Link from 'next/link';

export default function Header({ email, isStudent, isAdmin }: { email?: string; isStudent?: boolean; isAdmin?: boolean }) {
  return (
    <header className="topbar">
      <div className="container">
        <Link href="/" className="brand">
          <img src="/brand/petrosafe-logo.png" alt="PetroSafe" />
          <div>
            <strong>CFPS Preparation Course</strong>
            <span>Group D — Loss Prevention · Wave 3</span>
          </div>
        </Link>
        {email && (isStudent || isAdmin) && (
          <nav className="nav">
            <Link href="/study-plan">Study plan</Link>
            <Link href="/handout">Handout</Link>
            <Link href="/practice">Practice</Link>
            <Link href="/study">Study</Link>
            <Link href="/history">My results</Link>
            {isAdmin && <Link href="/admin">Admin</Link>}
          </nav>
        )}
        <div className="badges">
          <img src="/brand/ministry-petroleum-logo.png" alt="Ministry of Petroleum & Mineral Resources" />
          <img src="/brand/psai-wave3-badge.png" alt="Process Safety and Asset Integrity — Wave 3" />
          {email && (
            <form action="/auth/signout" method="post" className="userbox">
              <span>{email}</span>
              <button className="linkbtn" type="submit">Sign out</button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
