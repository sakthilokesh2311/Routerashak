import { useEffect, useState, type ReactNode } from 'react';
import { Link, Route, Switch, useLocation, useRoute } from 'wouter';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Activity, ArrowRight, Bell, BusFront, CalendarDays, Check, CheckCircle2,
  CircleHelp, ClipboardList, Clock3, Compass, FileText, Gauge, LayoutDashboard, Leaf, LogOut,
  MapPin, Menu, Navigation, Pencil, Plus, Route as RouteIcon, Search, Send, Settings, Shield, ShieldCheck,
  Sparkles, TriangleAlert, Users, X,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { AppData, CampusRoute, Role, Stop, User } from './types';
import { currentUser, logout, signIn, signUp, sendPasswordReset, initAuthListener } from './services/auth';
import { cancelBooking, createBooking } from './services/bookings';
import { addNotification, markNotificationRead } from './services/notifications';
import { initSupabaseSync, readData, resetData, writeData } from './services/persistence';
import { assignReplacement, createRescue, updateRescueStatus } from './services/rescue';
import { isSupabaseConfigured } from './lib/supabase';
import {
  seedSupabaseFromData,
  supabaseUpdateRouteStops,
  supabaseUpsertBus,
  supabaseUpdateBus,
  supabaseUpsertRoute,
  supabaseUpdateRouteStatus,
  supabaseUpsertJourney,
  supabaseCreateIncident,
  supabaseUpdateDriverStatus,
} from './services/supabaseService';
import { GoogleMapViewer } from './components/GoogleMapViewer';

const roles: Role[] = ['student', 'driver', 'admin'];
const navByRole: Record<Role, { group: string; links: { label: string; path: string; icon: typeof LayoutDashboard }[] }[]> = {
  student: [
    { group: 'My travel', links: [
      { label: 'Dashboard', path: '/student/dashboard', icon: LayoutDashboard }, { label: 'Find a bus', path: '/student/buses', icon: Search },
      { label: 'Journey planner', path: '/student/planner', icon: Compass }, { label: 'My bookings', path: '/student/bookings', icon: ClipboardList },
      { label: 'Live tracking', path: '/student/tracking', icon: Navigation },
    ] },
    { group: 'Travel care', links: [
      { label: 'Journey rescue', path: '/student/rescue', icon: ShieldCheck }, { label: 'Demand pulse', path: '/student/demand-pulse', icon: Activity },
      { label: 'Journey safety', path: '/student/safety', icon: Shield }, { label: 'My reports', path: '/student/reports', icon: FileText },
    ] },
    { group: 'You', links: [
      { label: 'Notifications', path: '/student/notifications', icon: Bell }, { label: 'Profile', path: '/student/profile', icon: Users },
      { label: 'Help & support', path: '/student/support', icon: CircleHelp },
    ] },
  ],
  driver: [
    { group: 'On the road', links: [
      { label: 'Dashboard', path: '/driver/dashboard', icon: LayoutDashboard }, { label: 'Assigned route', path: '/driver/route', icon: RouteIcon },
      { label: 'Journey status', path: '/driver/journey', icon: Activity }, { label: 'Incidents', path: '/driver/incidents', icon: TriangleAlert },
      { label: 'Journey history', path: '/driver/history', icon: Clock3 },
    ] },
    { group: 'You', links: [
      { label: 'Notifications', path: '/driver/notifications', icon: Bell }, { label: 'Profile', path: '/driver/profile', icon: Users },
    ] },
  ],
  admin: [
    { group: 'Operations', links: [
      { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard }, { label: 'Fleet', path: '/admin/fleet', icon: BusFront },
      { label: 'Routes', path: '/admin/routes', icon: RouteIcon }, { label: 'Stops', path: '/admin/stops', icon: MapPin },
      { label: 'Drivers', path: '/admin/drivers', icon: Users }, { label: 'Bookings', path: '/admin/bookings', icon: ClipboardList },
      { label: 'Rescue desk', path: '/admin/rescue', icon: ShieldCheck }, { label: 'Analytics', path: '/admin/analytics', icon: Activity },
      { label: 'Reports', path: '/admin/reports', icon: FileText },
    ] },
    { group: 'You', links: [
      { label: 'Notifications', path: '/admin/notifications', icon: Bell }, { label: 'Profile', path: '/admin/profile', icon: Users },
    ] },
  ],
};
const titles: Record<string, string> = {
  dashboard: 'Dashboard', buses: 'Find a bus', planner: 'Journey planner', bookings: 'My bookings', tracking: 'Live tracking',
  rescue: 'Journey rescue', 'demand-pulse': 'Demand pulse', safety: 'Journey safety', reports: 'Reports', notifications: 'Notifications',
  profile: 'Profile', settings: 'Settings', support: 'Help & support', route: 'Assigned route', journey: 'Journey status',
  incidents: 'Incidents', history: 'Journey history', fleet: 'Fleet management', routes: 'Route management', stops: 'Stop management',
  drivers: 'Driver management', analytics: 'Demand pulse analytics',
};
const dateNow = () => new Date().toISOString().slice(0, 10);
const iconBox = { background: '#DCEFE4', color: '#174D38' };

function Brand({ inverse = false }: { inverse?: boolean }) {
  return <span className="brand" style={inverse ? { color: 'white' } : undefined}><span className="brand-mark"><Shield size={20} strokeWidth={2.3} /></span><span>RouteRakshak <span style={{ fontWeight: 500 }}>AI</span></span></span>;
}

function PublicNav() {
  return <nav className="public-nav"><Link href="/" aria-label="RouteRakshak home"><Brand /></Link><div className="public-links">
    <Link href="/features">Features</Link><Link href="/how-it-works">How it works</Link><Link href="/about">About</Link><Link href="/contact">Contact</Link>
  </div><div className="row" style={{ justifyContent: 'flex-end' }}><Link href="/login" className="btn btn-outline btn-small">Sign in</Link><Link href="/register" className="btn btn-primary btn-small">Get started <ArrowRight size={14} /></Link></div></nav>;
}

function CampusIllustration() {
  return <svg className="campus-art" viewBox="0 0 600 470" role="img" aria-label="Illustration of a campus shuttle route connecting green campus landmarks">
    <rect width="600" height="470" fill="#E7F0E7" />
    <path d="M20 367C150 314 216 382 326 320s166-18 255-102" fill="none" stroke="#c6d9c6" strokeWidth="22" strokeLinecap="round" />
    <path d="M23 367C151 314 216 382 326 320s166-18 255-102" fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="10 10" />
    <ellipse cx="119" cy="135" rx="67" ry="33" fill="#d2e4d1" /><ellipse cx="469" cy="106" rx="85" ry="38" fill="#d2e4d1" />
    <rect x="60" y="179" width="100" height="78" rx="7" fill="#d5e3d2" /><path d="M51 181l60-39 60 39" fill="#8bad8d" /><rect x="86" y="207" width="18" height="50" fill="#a5bea4" /><rect x="119" y="199" width="23" height="20" fill="#edf4eb" />
    <rect x="390" y="170" width="131" height="89" rx="7" fill="#d5e3d2" /><path d="M379 173l77-47 78 47" fill="#7da582" /><rect x="409" y="194" width="20" height="24" fill="#edf4eb" /><rect x="445" y="194" width="20" height="24" fill="#edf4eb" /><rect x="480" y="194" width="20" height="24" fill="#edf4eb" />
    <circle cx="218" cy="144" r="30" fill="#a9c9a8" /><circle cx="218" cy="144" r="19" fill="#7eaa81" /><rect x="215" y="164" width="6" height="35" fill="#789478" />
    <circle cx="345" cy="205" r="28" fill="#a9c9a8" /><circle cx="345" cy="205" r="18" fill="#7eaa81" /><rect x="342" y="224" width="6" height="34" fill="#789478" />
    <g transform="translate(242 300)"><rect x="0" y="0" width="130" height="62" rx="15" fill="#174D38" /><rect x="11" y="10" width="78" height="26" rx="6" fill="#dcefe4" /><rect x="96" y="10" width="22" height="26" rx="5" fill="#b5d4ba" /><circle cx="29" cy="62" r="11" fill="#263b2e" /><circle cx="101" cy="62" r="11" fill="#263b2e" /><path d="M17 47h95" stroke="#5b9973" strokeWidth="3" /></g>
    <circle cx="64" cy="368" r="10" fill="#247653" stroke="#fff" strokeWidth="5" /><circle cx="567" cy="218" r="10" fill="#247653" stroke="#fff" strokeWidth="5" />
    <text x="54" y="424" fontSize="12" fill="#4d6755" fontFamily="Inter">LAKEVIEW GATE</text><text x="430" y="285" fontSize="12" fill="#4d6755" fontFamily="Inter">CENTRAL CAMPUS</text>
  </svg>;
}

function PublicPage() {
  const [path] = useLocation();
  const isHome = path === '/';
  const content: Record<string, { eyebrow: string; title: string; text: string }> = {
    '/features': { eyebrow: 'A better campus commute', title: 'The whole journey, looked after.', text: 'A connected transport workspace designed around clear information, thoughtful access, and a practical plan when the unexpected happens.' },
    '/how-it-works': { eyebrow: 'From doorstep to destination', title: 'Good journeys start with a clear plan.', text: 'Find a route, reserve a demo seat, and see the journey status in one place. If plans change, a coordinated rescue request keeps the right people informed.' },
    '/about': { eyebrow: 'Our purpose', title: 'Campus travel should feel dependable.', text: 'RouteRakshak brings students, drivers, and transport teams into one shared prototype for safer, more coordinated campus journeys.' },
    '/contact': { eyebrow: 'Talk with the transport team', title: 'We are here to help you get moving.', text: 'This prototype contact page is a local demonstration. Messages are not sent to a transport office.' },
  };
  const page = content[path] ?? content['/about'];
  const featureData = [
    { icon: <ShieldCheck size={20} />, title: 'Journey Rescue', text: 'A clear path to report disruption and coordinate replacement transport with the campus team.' },
    { icon: <Activity size={20} />, title: 'Demand Pulse', text: 'Readable sample occupancy and route patterns help teams understand where capacity is needed.' },
    { icon: <AccessibilityIcon />, title: 'Access-first matching', text: 'Filter journeys by step-free and mobility preferences before choosing a route.' },
    { icon: <Shield size={20} />, title: 'Journey safety', text: 'Check-ins, route context, and honest support workflows keep safety information close.' },
  ];
  return <div className="public-page"><PublicNav />
    {isHome ? <>
      <section className="hero"><div><div className="eyebrow"><Leaf size={15} /> CAMPUS TRAVEL, IN GOOD HANDS</div><h1>Smarter Campus Travel. Safer Journeys.</h1><p>One calm place to plan a campus trip, reserve a seat, and know where to turn when a journey changes.</p><div className="hero-actions"><Link className="btn btn-primary" href="/login">Plan your journey <ArrowRight size={16} /></Link><Link className="btn btn-outline" href="/features">Explore features</Link></div><div className="row" style={{ justifyContent: 'flex-start', marginTop: 24, gap: 10, color: '#69766D', fontSize: 12 }}><ShieldCheck size={16} color="#247653" /> Designed for students, drivers, and campus transport teams</div></div><div className="hero-art"><CampusIllustration /><div className="hero-note"><span className="feature-icon" style={{ margin: 0 }}><Navigation size={18} /></span><span><strong style={{ color: '#103B2B' }}>North Loop</strong><br /><span className="muted">A connected campus journey</span></span><span className="tag">DEMO DATA</span></div></div></section>
      <section className="section section-tint"><div className="section-inner"><div className="eyebrow">BUILT AROUND REAL JOURNEYS</div><h2>More than a bus schedule.</h2><p className="section-lead">Bring planning, accessibility, journey updates, and disruption support together in one considered experience.</p><div className="feature-grid">{featureData.map((item, i) => <article className="feature-tile" key={item.title}><div className="feature-icon">{item.icon}</div><h3>{item.title}</h3><p>{item.text}</p></article>)}</div></div></section>
      <section className="section"><div className="section-inner"><div className="eyebrow">THREE SIMPLE STEPS</div><h2>From a plan to a more confident arrival.</h2><div className="steps-grid">{[['01', 'Choose your journey', 'Compare campus routes, times, and access features that suit your day.'], ['02', 'Travel with clarity', 'See your booking and a clearly labelled demo journey status in one place.'], ['03', 'Get coordinated help', 'If a bus is disrupted, send a request that the transport team can review.']].map(step => <div className="step" key={step[0]}><div className="step-num">STEP {step[0]}</div><h3>{step[1]}</h3><p>{step[2]}</p></div>)}</div></div></section>
      <section className="section section-tint"><div className="section-inner audience-grid"><div><div className="eyebrow">ONE CAMPUS, IN SYNC</div><h2>One journey. Three connected perspectives.</h2><p className="section-lead">A shared prototype workspace gives each person the information and actions that belong to their role.</p><Link href="/login" className="btn btn-primary" style={{ marginTop: 22 }}>Choose a demo role <ArrowRight size={15} /></Link></div><div className="audience-list">{[['Students', 'Plan and book campus travel, then follow progress or request help.'], ['Drivers', 'Review assigned routes, update journey status, and report incidents.'], ['Transport teams', 'Coordinate fleet, routes, bookings, and replacement transport.']].map(([title, text]) => <div className="audience-item" key={title}><span className="feature-icon" style={{ margin: 0 }}><Check size={18} /></span><div><strong>{title}</strong><div className="muted small" style={{ marginTop: 5 }}>{text}</div></div></div>)}</div></div></section>
      <section className="section"><div className="section-inner panel row" style={{ padding: '34px 38px', flexWrap: 'wrap' }}><div><div className="eyebrow">A PROTOTYPE WITH CLEAR LIMITS</div><h2 style={{ fontSize: 31, marginBottom: 7 }}>See how the journey fits together.</h2><p className="muted small">Local demo data only. No live GPS, emergency dispatch, or secure production authentication.</p></div><Link href="/login" className="btn btn-primary">Explore the demo <ArrowRight size={15} /></Link></div></section>
    </> : <>
      <section className="hero" style={{ minHeight: '52vh' }}><div><div className="eyebrow">{page.eyebrow}</div><h1 style={{ fontSize: 'clamp(42px,5vw,64px)' }}>{page.title}</h1><p>{page.text}</p>{path === '/contact' ? <div className="panel" style={{ marginTop: 24 }}><strong>Prototype support</strong><p className="small">Use the Help & Support area after selecting a demo role. This message form does not deliver email.</p><Link href="/login" className="btn btn-primary">Open demo workspace</Link></div> : <Link href="/login" className="btn btn-primary" style={{ marginTop: 18 }}>Try the prototype <ArrowRight size={15} /></Link>}</div><div className="hero-art"><CampusIllustration /></div></section>
      {path === '/features' ? <section className="section section-tint"><div className="section-inner"><div className="eyebrow">THE JOURNEY, IN CONTEXT</div><h2>Useful details before, during, and after the ride.</h2><div className="feature-grid">{featureData.map(item => <article className="feature-tile" key={item.title}><div className="feature-icon">{item.icon}</div><h3>{item.title}</h3><p>{item.text}</p></article>)}</div><div className="notice warn" style={{ marginTop: 20 }}>Prototype boundaries are visible throughout: no live GPS, AI model, emergency dispatch, or real seat reservation is connected.</div></div></section> : path === '/how-it-works' ? <section className="section section-tint"><div className="section-inner"><div className="eyebrow">THREE CONNECTED MOMENTS</div><h2>A practical flow when everything goes to plan — and when it does not.</h2><div className="steps-grid">{[['01', 'Plan', 'Search by stop, departure, and accessibility needs. Compare the sample journey before you commit.'], ['02', 'Travel', 'Keep your local booking reference and route status together. Tracking is a schematic, not live GPS.'], ['03', 'Coordinate', 'Submit a disruption report for review. An admin can assign an available replacement in this demo.']].map(step => <article className="step" key={step[0]}><div className="step-num">MOMENT {step[0]}</div><h3>{step[1]}</h3><p>{step[2]}</p></article>)}</div><Link href="/login" className="btn btn-primary" style={{ marginTop: 25 }}>Choose your demo role <ArrowRight size={15} /></Link></div></section> : path === '/about' ? <section className="section section-tint"><div className="section-inner audience-grid"><div><div className="eyebrow">BUILT FOR CAMPUS CONNECTIONS</div><h2>Better coordination starts with shared context.</h2><p className="section-lead">Students need clarity. Drivers need a useful route workspace. Transport teams need the right operational picture. RouteRakshak demonstrates how those views can connect without obscuring what is still only a prototype.</p></div><div className="audience-list">{[['Clarity', 'Plain-language statuses and visible sample-data labels.'], ['Access', 'Journey matching makes accessibility needs part of the search.'], ['Honesty', 'No invented live location, predictions, or emergency confirmations.']].map(([title, text]) => <div className="audience-item" key={title}><span className="feature-icon" style={{ margin: 0 }}><Check size={18} /></span><div><strong>{title}</strong><div className="muted small" style={{ marginTop: 5 }}>{text}</div></div></div>)}</div></div></section> : <section className="section section-tint"><div className="section-inner panel row" style={{ flexWrap: 'wrap' }}><div><div className="eyebrow">NEED JOURNEY SUPPORT?</div><h2 style={{ fontSize: 30 }}>Open the local support workspace.</h2><p className="muted small">Messages submitted here are not delivered externally. Choose a student demo role to see the connected support tools.</p></div><Link href="/login" className="btn btn-primary">Continue to demo <ArrowRight size={15} /></Link></div></section>}
    </>}
    <footer className="footer"><div className="footer-inner"><div><Brand inverse /><p style={{ maxWidth: 310, lineHeight: 1.6 }}>A thoughtful campus transport prototype for planning, coordination, and safer journeys.</p></div><div><strong>Explore</strong><p><Link href="/features">Features</Link></p><p><Link href="/how-it-works">How it works</Link></p><p><Link href="/about">About</Link></p></div><div><strong>Get started</strong><p><Link href="/login">Sign in to demo</Link></p><p><Link href="/register">Create demo profile</Link></p><p><Link href="/contact">Contact</Link></p></div><div className="small" style={{ maxWidth: 240, lineHeight: 1.6 }}>DEMO PROTOTYPE<br />No live vehicle location, emergency dispatch, or real reservation service.</div></div></footer>
  </div>;
}

function AccessibilityIcon() { return <Users size={20} />; }

function AuthPage() {
  const [path, navigate] = useLocation();
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const register = path === '/register';
  const forgot = path === '/forgot-password';

  useEffect(() => {
    const existing = currentUser();
    if (existing) {
      navigate(`/${existing.role}/dashboard`);
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (forgot) {
        if (!email.trim()) throw new Error('Please enter your email address.');
        await sendPasswordReset(email.trim());
        setMessage('Password reset instructions sent. Please check your email.');
      } else if (register) {
        if (!name.trim()) throw new Error('Please enter your full name.');
        if (!email.trim()) throw new Error('Please enter your email.');
        if (password.length < 6) throw new Error('Password must be at least 6 characters.');
        const res = await signUp(email.trim(), password, name.trim(), role, phone.trim());
        if (res.requiresEmailConfirmation) {
          setMessage('Account created! Please check your email to confirm your account, then sign in.');
        } else if (res.user) {
          setToast(`Welcome to RouteRakshak, ${res.user.name}!`);
          navigate(`/${res.user.role}/dashboard`);
        }
      } else {
        if (!email.trim() || !password) throw new Error('Please enter your email and password.');
        const user = await signIn(email.trim(), password);
        setToast(`Welcome back, ${user.name}!`);
        navigate(`/${user.role}/dashboard`);
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-story">
        <div>
          <Link href="/"><Brand inverse /></Link>
          <div style={{ marginTop: 75 }}>
            <div className="eyebrow" style={{ color: '#b6d9c2' }}>CAMPUS TRANSIT PORTAL</div>
            <h1>Travel well.<br />Know what comes next.</h1>
            <p style={{ maxWidth: 410, color: '#d2e0d5', lineHeight: 1.7 }}>
              Secure portal for students, drivers, and transport administrators. Real-time fleet tracking, safe route coordination, and emergency response.
            </p>
          </div>
        </div>
        <div className="small" style={{ color: '#c3d3c7', lineHeight: 1.7 }}>
          Protected by Supabase Authentication · TLS 256-bit Encrypted
        </div>
      </div>

      <div className="auth-card-wrap">
        <div className="auth-card">
          <Link href="/" className="small muted">← Back to RouteRakshak</Link>
          <div className="eyebrow" style={{ marginTop: 26 }}>
            {forgot ? 'PASSWORD RECOVERY' : register ? 'CREATE YOUR ACCOUNT' : 'SECURE SIGN IN'}
          </div>
          <h2 style={{ color: '#103B2B', fontSize: 28, letterSpacing: '-.04em', margin: '10px 0' }}>
            {forgot ? 'Reset password' : register ? 'Join RouteRakshak' : 'Sign in to workspace'}
          </h2>
          <p className="muted small" style={{ lineHeight: 1.6, marginBottom: 20 }}>
            {forgot
              ? 'Enter your registered email to receive a password reset link.'
              : register
              ? 'Complete your profile to register your student account and access campus routes.'
              : 'Sign in with your email and password to access your dashboard.'}
          </p>

          {error && (
            <div className="notice warn" style={{ marginBottom: 16 }}>
              {error}
            </div>
          )}

          {message && (
            <div className="notice" style={{ marginBottom: 16, borderColor: '#247653', color: '#174D38', background: '#eaf6ee' }}>
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="stack" style={{ gap: 14 }}>
            {register && (
              <>
                <div className="field">
                  <label htmlFor="auth-name">Full Name</label>
                  <input
                    id="auth-name"
                    type="text"
                    required
                    placeholder="e.g. Alex Johnson"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="auth-phone">Phone Number (optional)</label>
                  <input
                    id="auth-phone"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="field">
              <label htmlFor="auth-email">Email Address</label>
              <input
                id="auth-email"
                type="email"
                required
                placeholder="you@campus.edu"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            {!forgot && (
              <div className="field">
                <div className="row" style={{ marginBottom: 4 }}>
                  <label htmlFor="auth-password" style={{ margin: 0 }}>Password</label>
                  {!register && (
                    <Link href="/forgot-password" className="small muted">
                      Forgot password?
                    </Link>
                  )}
                </div>
                <input
                  id="auth-password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
            )}

            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading}
              style={{ width: '100%', marginTop: 8 }}
            >
              {loading
                ? 'Processing...'
                : forgot
                ? 'Send reset link'
                : register
                ? 'Create account'
                : 'Sign in'}
            </button>
          </form>

          <div className="row small" style={{ marginTop: 20, justifyContent: 'center', gap: 6 }}>
            {register ? (
              <>
                <span className="muted">Already have an account?</span>
                <Link href="/login" style={{ color: '#174D38', fontWeight: 700 }}>
                  Sign in
                </Link>
              </>
            ) : forgot ? (
              <Link href="/login" style={{ color: '#174D38', fontWeight: 700 }}>
                Return to sign in
              </Link>
            ) : (
              <>
                <span className="muted">Don't have an account?</span>
                <Link href="/register" style={{ color: '#174D38', fontWeight: 700 }}>
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
      {toast && <Toast message={toast} onDismiss={() => setToast('')} />}
    </div>
  );
}

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => { const id = window.setTimeout(onDismiss, 3200); return () => window.clearTimeout(id); }, [message, onDismiss]);
  return <div role="status" aria-live="polite" className="toast">{message}</div>;
}

function Badge({ children, tone = '' }: { children: ReactNode; tone?: string }) { return <span className={`tag ${tone}`}>{children}</span>; }
function PageHead({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return <div className="page-heading"><div><h1>{title}</h1><p>{text}</p></div>{action}</div>;
}
function Stat({ label, value, hint, icon }: { label: string; value: string | number; hint: string; icon: ReactNode }) {
  return <div className="panel"><div className="stat-label"><span>{label}</span><span className="feature-icon" style={{ width: 33, height: 33, margin: 0 }}>{icon}</span></div><div className="stat-value">{value}</div><div className="stat-hint">{hint}</div></div>;
}
function Portal({ role }: { role: Role }) {
  const [path, navigate] = useLocation();
  const [routeMatch, routeParams] = useRoute('/student/routes/:routeId');
  const [user, setUser] = useState<User | null>(currentUser());
  const [data, setData] = useState<AppData>(readData());
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [query, setQuery] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState(dateNow());
  const [preferredTime, setPreferredTime] = useState('');
  const [filterAccess, setFilterAccess] = useState(false);
  const [wheelchairPref, setWheelchairPref] = useState(false);
  const [lowStepPref, setLowStepPref] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [selectedRescue, setSelectedRescue] = useState('');
  const [replacement, setReplacement] = useState('');
  const [confirmBooking, setConfirmBooking] = useState('');
  const [incidentError, setIncidentError] = useState('');
  const [busName, setBusName] = useState('');
  const [busPlate, setBusPlate] = useState('');
  const [busCapacity, setBusCapacity] = useState('36');
  const [busAccessible, setBusAccessible] = useState(true);
  const [routeId, setRouteId] = useState('route-north');
  const [rescueCategory, setRescueCategory] = useState('Breakdown');
  const [rescueDescription, setRescueDescription] = useState('');
  const [replacementRequested, setReplacementRequested] = useState(true);
  const [safetyCheck, setSafetyCheck] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [stopRouteId, setStopRouteId] = useState('');
  const [stopName, setStopName] = useState('');
  const [stopTime, setStopTime] = useState('08:00');
  const [stopFormOpen, setStopFormOpen] = useState(false);
  const [savedPlans, setSavedPlans] = useState<{ routeId: string; date: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('routerakshak-saved-plans') ?? '[]') as { routeId: string; date: string }[]; } catch { return []; }
  });
  const rescueSchema = z.object({ description: z.string().min(8, 'Please add a little more detail (at least 8 characters).') });
  const rescueForm = useForm<{ description: string }>({ resolver: zodResolver(rescueSchema), defaultValues: { description: '' } });

  useEffect(() => {
    initSupabaseSync();
    const unsub = initAuthListener(nextUser => {
      setUser(nextUser);
      if (!nextUser) navigate('/login');
    });
    const sync = () => { setData(readData()); setUser(currentUser()); };
    window.addEventListener('routerakshak-change', sync); window.addEventListener('storage', sync);
    return () => {
      unsub();
      window.removeEventListener('routerakshak-change', sync); window.removeEventListener('storage', sync);
    };
  }, [navigate]);
  useEffect(() => {
    if (!user) {
      navigate('/login');
    } else if (user.role !== role) {
      navigate(`/${user.role}/dashboard`);
    }
  }, [user, role, navigate]);
  useEffect(() => { if (user && !profileName) setProfileName(user.name); }, [user, profileName]);
  const pageKey = path.split('/').filter(Boolean)[1] ?? 'dashboard';
  const title = routeMatch ? 'Route details' : titles[pageKey] ?? 'Workspace';
  const userId = user?.id ?? `${role}-1`;
  const myNotifications = data.notifications.filter(n => n.userId === userId || (role === 'admin' && n.userId === 'admin-1'));
  const myBookings = data.bookings.filter(b => role === 'admin' || b.userId === userId);
  const activeRoutes = data.routes.filter(route => route.status === 'Active');
  const routeDetails = routeMatch ? data.routes.find(r => r.id === (routeParams as { routeId?: string } | null)?.routeId) : undefined;
  const myRoute = data.routes.find(r => r.id === (role === 'driver' ? data.drivers.find(d => d.id === userId)?.routeId : 'route-north')) ?? data.routes[0];
  const driverIncidents = data.incidents.filter(incident => role === 'admin' || incident.driverId === userId);
  const myRescues = data.rescues.filter(rescue => role === 'admin' || rescue.userId === userId || (role === 'driver' && rescue.source === 'Driver'));
  const filteredRoutes = activeRoutes.filter(route =>
    (!origin || route.origin.toLowerCase().includes(origin.toLowerCase()) || route.stops.some(stop => stop.name.toLowerCase().includes(origin.toLowerCase()))) &&
    (!destination || route.destination.toLowerCase().includes(destination.toLowerCase()) || route.stops.some(stop => stop.name.toLowerCase().includes(destination.toLowerCase()))) &&
    (!(filterAccess || wheelchairPref || lowStepPref) || route.accessible) &&
    (!preferredTime || (preferredTime === 'early' ? route.schedule.departure < '09:00' : preferredTime === 'midday' ? route.schedule.departure >= '09:00' && route.schedule.departure < '12:00' : route.schedule.departure >= '12:00')) &&
    (!query || `${route.name} ${route.origin} ${route.destination}`.toLowerCase().includes(query.toLowerCase())));
  const go = (url: string) => navigate(url);
  const flash = (message: string) => setToast(message);
  const currentRoute = routeDetails ?? myRoute;
  const safeWrite = (next: AppData) => { writeData(next); setData(readData()); };

  const onBook = (route: CampusRoute) => {
    const bus = data.buses.find(item => item.id === route.busId);
    if (date < dateNow()) { flash('Choose today or a future travel date.'); return; }
    if (!bus || bus.available < 1) { flash('There are no demo seats currently available on this route.'); return; }
    const booking = createBooking(route, date || dateNow(), userId); setData(readData()); flash(`Seat booked. Reference ${booking.reference}`);
  };
  const savePlan = (route: CampusRoute) => {
    const next = [{ routeId: route.id, date }, ...savedPlans.filter(plan => plan.routeId !== route.id)];
    setSavedPlans(next); localStorage.setItem('routerakshak-saved-plans', JSON.stringify(next)); flash(`${route.name} plan saved on this device.`);
  };
  const removeSavedPlan = (routeId: string) => {
    const next = savedPlans.filter(plan => plan.routeId !== routeId);
    setSavedPlans(next); localStorage.setItem('routerakshak-saved-plans', JSON.stringify(next)); flash('Saved plan removed.');
  };
  const onCancelBooking = (id: string) => { cancelBooking(id); setConfirmBooking(''); setData(readData()); flash('Booking cancelled. A seat was returned to availability.'); };
  const submitRescue = (values: { description: string }) => {
    const affected = data.bookings.find(b => b.id === selectedRescue && b.status === 'Upcoming');
    createRescue({ userId, routeId: affected?.routeId ?? routeId, bookingId: affected?.id, category: rescueCategory, description: values.description, source: role === 'driver' ? 'Driver' : 'Student', requestReplacement: replacementRequested });
    setData(readData()); rescueForm.reset(); setRescueDescription(''); flash('Rescue request sent to the local demo workspace.'); go(`/${role}/rescue`);
  };
  const submitDriverIncident = async () => {
    if (rescueDescription.trim().length < 8) { setIncidentError('Please describe the issue in at least 8 characters.'); return; }
    const request = createRescue({ userId, routeId: myRoute.id, category: 'Breakdown', description: rescueDescription.trim(), source: 'Driver', requestReplacement: true });
    const newIncident: import('./types').Incident = {
      id: `incident-${Date.now()}`,
      driverId: userId,
      routeId: myRoute.id,
      busId: myRoute.busId,
      rescueId: request.id,
      category: 'Breakdown',
      description: rescueDescription.trim(),
      status: 'Submitted',
      createdAt: new Date().toISOString(),
    };
    const next = readData();
    next.incidents.unshift(newIncident);
    writeData(next);
    setData(readData());

    if (isSupabaseConfigured()) {
      await supabaseCreateIncident(newIncident);
    }

    setRescueDescription('');
    setIncidentError('');
    flash('Incident reported. The admin rescue desk can now review it.');
  };

  const assign = () => {
    if (!replacement) { flash('Choose an available replacement bus first.'); return; }
    if (assignReplacement(selectedRescue, replacement)) { setData(readData()); setSelectedRescue(''); flash('Available replacement assigned. Student status updated.'); }
    else flash('That bus is no longer available. Refresh the case and choose another.');
  };

  const updateJourney = async (status: 'Boarding' | 'In Transit' | 'Delayed' | 'Completed') => {
    const next = readData();
    const journey: import('./types').Journey = next.journeys.find(j => j.routeId === myRoute.id) ?? {
      id: `journey-${Date.now()}`,
      routeId: myRoute.id,
      busId: myRoute.busId,
      status: 'Scheduled',
      date: dateNow(),
      completedStops: 0,
    };
    const transitions: Record<string, string[]> = {
      Scheduled: ['Boarding'],
      Boarding: ['In Transit', 'Delayed'],
      'In Transit': ['Delayed', 'Completed'],
      Delayed: ['In Transit', 'Completed'],
      Completed: [],
    };
    if (!transitions[journey.status].includes(status)) {
      flash(`Cannot change from ${journey.status} to ${status}.`);
      return;
    }
    journey.status = status;
    if (!next.journeys.some(j => j.id === journey.id)) {
      next.journeys.unshift(journey);
    }
    safeWrite(next);
    addNotification('admin-1', 'Journey status updated', `${myRoute.name} is now ${status}.`);

    if (isSupabaseConfigured()) {
      await supabaseUpsertJourney(journey);
    }

    flash(`Journey marked ${status}.`);
  };
  const markAllRead = () => { const next = readData(); next.notifications.forEach(n => { if (n.userId === userId) n.read = true; }); safeWrite(next); flash('Notifications marked as read.'); };
  const markOneRead = (id: string) => { markNotificationRead(id); setData(readData()); };
  const saveBus = async () => {
    if (!busName.trim() || !busPlate.trim() || Number(busCapacity) < 1) { flash('Add a bus name, registration, and valid capacity.'); return; }
    const next = readData();
    let targetBus: import('./types').Bus;
    if (editId) {
      const item = next.buses.find(b => b.id === editId);
      if (item) {
        item.name = busName;
        item.plate = busPlate;
        item.capacity = Number(busCapacity);
        item.available = Math.min(item.available, item.capacity);
        item.accessible = busAccessible;
        targetBus = item;
      } else {
        return;
      }
    } else {
      targetBus = {
        id: `bus-${Date.now()}`,
        name: busName,
        plate: busPlate,
        capacity: Number(busCapacity),
        available: Number(busCapacity),
        accessible: busAccessible,
        status: 'Available',
      };
      next.buses.unshift(targetBus);
    }
    safeWrite(next);
    setFormOpen(false);
    setEditId('');
    setBusName('');
    setBusPlate('');

    if (isSupabaseConfigured()) {
      await supabaseUpsertBus(targetBus);
    }

    flash(editId ? 'Bus details updated.' : 'Bus added to the fleet.');
  };

  const editBus = (id: string) => {
    const item = data.buses.find(b => b.id === id);
    if (!item) return;
    setEditId(id);
    setBusName(item.name);
    setBusPlate(item.plate);
    setBusCapacity(String(item.capacity));
    setBusAccessible(item.accessible);
    setFormOpen(true);
  };

  const toggleBus = async (id: string) => {
    const next = readData();
    const item = next.buses.find(b => b.id === id);
    if (!item) return;
    item.status = item.status === 'Maintenance' ? 'Available' : item.status === 'Available' ? 'Maintenance' : 'Available';
    safeWrite(next);

    if (isSupabaseConfigured()) {
      await supabaseUpdateBus(item.id, { status: item.status });
    }

    flash(`${item.name} is now ${item.status.toLowerCase()}.`);
  };

  const addRoute = async () => {
    const bus = data.buses.find(b => b.id === routeId);
    const next = readData();
    if (editId) {
      const existing = next.routes.find(r => r.id === editId);
      const priorBus = existing && next.buses.find(b => b.id === existing.busId);
      if (!existing || !bus || (bus.status !== 'Available' && bus.id !== existing.busId)) { flash('Route assignment requires an existing available bus.'); return; }
      if (priorBus && priorBus.id !== bus.id) {
        priorBus.status = 'Available';
        priorBus.routeId = undefined;
        if (isSupabaseConfigured()) {
          await supabaseUpdateBus(priorBus.id, { status: 'Available', routeId: null });
        }
      }
      bus.status = 'Assigned';
      bus.routeId = existing.id;
      existing.name = busName.trim() || existing.name;
      existing.origin = origin || existing.origin;
      existing.destination = destination || existing.destination;
      existing.busId = bus.id;
      existing.accessible = bus.accessible;
      if (existing.stops.length > 0) {
        existing.stops[0].name = existing.origin;
        existing.stops[existing.stops.length - 1].name = existing.destination;
      }
      safeWrite(next);
      setFormOpen(false);
      setEditId('');

      if (isSupabaseConfigured()) {
        await supabaseUpsertRoute(existing);
        await supabaseUpdateBus(bus.id, { status: 'Assigned', routeId: existing.id });
      }

      flash('Route details and vehicle assignment updated.');
      return;
    }

    if (!bus || bus.status !== 'Available') { flash('Route assignment requires an existing available bus.'); return; }
    const id = `route-${Date.now()}`;
    const newRoute: CampusRoute = {
      id,
      name: busName.trim() || `Campus Link ${next.routes.length + 1}`,
      origin: origin || 'West Residence',
      destination: destination || 'Central Campus',
      duration: 24,
      busId: bus.id,
      accessible: bus.accessible,
      status: 'Active',
      stops: [
        { id: `${id}-1`, name: origin || 'West Residence', time: '08:10', sequence: 1 },
        { id: `${id}-2`, name: destination || 'Central Campus', time: '08:34', sequence: 2 },
      ],
      schedule: { departure: '08:10', arrival: '08:34', days: ['Weekdays'] },
    };
    next.routes.unshift(newRoute);
    bus.status = 'Assigned';
    bus.routeId = id;
    safeWrite(next);
    setFormOpen(false);
    setBusName('');

    if (isSupabaseConfigured()) {
      await supabaseUpsertRoute(newRoute);
      await supabaseUpdateBus(bus.id, { status: 'Assigned', routeId: id });
    }

    flash('Route added and assigned to an available bus.');
  };

  const editRoute = (route: CampusRoute) => {
    setEditId(route.id);
    setBusName(route.name);
    setOrigin(route.origin);
    setDestination(route.destination);
    setRouteId(route.busId);
    setFormOpen(true);
  };

  const toggleRouteStatus = async (id: string) => {
    const next = readData();
    const item = next.routes.find(route => route.id === id);
    if (!item) return;
    item.status = item.status === 'Active' ? 'Inactive' : 'Active';
    safeWrite(next);

    if (isSupabaseConfigured()) {
      await supabaseUpdateRouteStatus(item.id, item.status);
    }

    flash(`${item.name} is now ${item.status.toLowerCase()}.`);
  };

  const addStop = async () => {
    const targetRouteId = stopRouteId || (data.routes[0]?.id ?? '');
    if (!targetRouteId) {
      flash('Please select a route first.');
      return;
    }
    if (!stopName.trim()) {
      flash('Please enter a stop name.');
      return;
    }
    const next = readData();
    const route = next.routes.find(r => r.id === targetRouteId);
    if (!route) {
      flash('Route not found.');
      return;
    }

    const newStop: Stop = {
      id: `stop-${Date.now()}`,
      name: stopName.trim(),
      time: stopTime || '08:00',
      sequence: 1,
    };

    route.stops.push(newStop);
    // Sort all stops ascending by scheduled time
    route.stops.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    // Re-assign 1-based sequential sequence numbers
    route.stops.forEach((s, idx) => {
      s.sequence = idx + 1;
    });

    // Update origin and destination departure/arrival schedule if needed
    if (route.stops.length >= 2) {
      route.origin = route.stops[0].name;
      route.destination = route.stops[route.stops.length - 1].name;
      route.schedule.departure = route.stops[0].time;
      route.schedule.arrival = route.stops[route.stops.length - 1].time;
    }

    safeWrite(next);

    if (isSupabaseConfigured()) {
      await supabaseUpsertRoute(route);
    }

    setStopName('');
    setStopFormOpen(false);
    flash(`Stop "${newStop.name}" added at ${newStop.time} in ascending order!`);
  };

  const removeStop = async (routeTargetId: string, stopId: string) => {
    const next = readData();
    const route = next.routes.find(r => r.id === routeTargetId);
    if (!route) return;
    route.stops = route.stops.filter(s => s.id !== stopId);
    // Sort all remaining stops ascending by scheduled time
    route.stops.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    route.stops.forEach((s, idx) => { s.sequence = idx + 1; });

    if (route.stops.length >= 2) {
      route.origin = route.stops[0].name;
      route.destination = route.stops[route.stops.length - 1].name;
      route.schedule.departure = route.stops[0].time;
      route.schedule.arrival = route.stops[route.stops.length - 1].time;
    }

    safeWrite(next);

    if (isSupabaseConfigured()) {
      await supabaseUpsertRoute(route);
    }
    flash('Stop removed successfully.');
  };

  const signOut = async () => { await logout(); setUser(null); navigate('/login'); };

  const SideNav = () => <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}><div className="row" style={{ justifyContent: 'space-between' }}><Link href={`/${role}/dashboard`}><Brand inverse /></Link><button className="mobile-toggle" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={20} /></button></div><div className="nav-label" style={{ paddingTop: 4 }}>CAMPUS TRANSIT</div>{navByRole[role].map(group => <div key={group.group}><div className="nav-label">{group.group}</div>{group.links.map(item => { const Icon = item.icon; return <Link key={item.path} className={`side-link ${path === item.path || (routeMatch && item.path === '/student/buses') ? 'active' : ''}`} href={item.path} onClick={() => setMobileOpen(false)} data-testid={`link-nav-${item.path.split('/').pop()}`}><Icon size={16} />{item.label}{item.label === 'Notifications' && myNotifications.some(n => !n.read) && <span style={{ marginLeft: 'auto', width: 7, height: 7, background: '#a9d6b7', borderRadius: 99 }} />}</Link>; })}</div>)}<div style={{ marginTop: 'auto', padding: '16px 10px 5px', borderTop: '1px solid #ffffff1e' }}><div className="small" style={{ color: '#b2c8b7', marginBottom: 13 }}>Signed in as <strong style={{ color: '#fff' }}>{user?.name || user?.email || role}</strong><div className="muted small" style={{ textTransform: 'capitalize' }}>{role} workspace</div></div><button className="side-link" onClick={signOut} style={{ width: '100%', background: 'transparent', border: 0, cursor: 'pointer', textAlign: 'left' }} data-testid="button-logout"><LogOut size={16} /> Sign out</button></div></aside>;
  const Header = () => <header className="topbar"><button className="mobile-toggle" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={20} /></button><div className="topbar-title">{title}</div><div className="topbar-right"><Link href={`/${role}/notifications`} className="btn btn-outline btn-small" aria-label="Open notifications"><Bell size={15} />{myNotifications.filter(n => !n.read).length > 0 && <Badge>{myNotifications.filter(n => !n.read).length} new</Badge>}</Link><div className="avatar">{user?.name.split(' ').map(part => part[0]).join('').slice(0, 2) ?? 'RR'}</div><span className="small muted" style={{ display: 'none' }}>{user?.name}</span></div></header>;

  const isBackendConnected = isSupabaseConfigured();
  const demoNotice = null;
  const RouteCard = ({ route }: { route: CampusRoute }) => <article className="panel route-card" data-testid={`card-route-${route.id}`}><div><div className="row" style={{ justifyContent: 'flex-start', marginBottom: 12 }}><Badge>{route.name}</Badge>{route.accessible && <Badge>Step-free access</Badge>}</div><div className="route-stops"><span><strong>{route.schedule.departure}</strong><br />{route.origin}</span><ArrowRight size={16} /><span><strong>{route.schedule.arrival}</strong><br />{route.destination}</span></div><div className="small muted" style={{ marginTop: 11 }}>{route.duration} min · {data.buses.find(b => b.id === route.busId)?.available ?? 0} seats available · SCHEDULED</div></div><div className="stack" style={{ justifyItems: 'end' }}><Link href={`/student/routes/${route.id}`} className="btn btn-outline btn-small">Details</Link><button className="btn btn-soft btn-small" onClick={() => savePlan(route)} data-testid={`button-save-plan-${route.id}`}>Save plan</button><button className="btn btn-primary btn-small" onClick={() => onBook(route)} disabled={(data.buses.find(b => b.id === route.busId)?.available ?? 0) < 1} data-testid={`button-book-${route.id}`}>Book seat</button></div></article>;
  const NotificationList = () => <div className="stack">{myNotifications.length ? myNotifications.map(n => <article className="panel row" style={{ alignItems: 'flex-start' }} key={n.id} data-testid={`card-notification-${n.id}`}><span className="feature-icon" style={{ margin: 0, flexShrink: 0 }}><Bell size={17} /></span><div style={{ flex: 1 }}><div className="row" style={{ justifyContent: 'flex-start' }}><strong>{n.title}</strong>{!n.read && <Badge>New</Badge>}</div><p className="small muted" style={{ margin: '5px 0' }}>{n.message}</p><span className="small muted">{new Date(n.createdAt).toLocaleString()}</span></div>{!n.read && <button className="btn btn-soft btn-small" onClick={() => markOneRead(n.id)} data-testid={`button-read-${n.id}`}>Mark read</button>}</article>) : <div className="panel empty"><Bell /><strong>No notifications yet</strong><p className="small">Updates from your journeys will appear here.</p></div>}</div>;
  const rescueFormBlock = <div className="panel"><h2>Report a travel disruption</h2><p className="small muted">Your request is visible to the admin demo workspace. It does not contact emergency services.</p><form onSubmit={rescueForm.handleSubmit(submitRescue)}><div className="form-grid"><div className="field"><label htmlFor="affected-booking">Affected booking (optional)</label><select id="affected-booking" value={selectedRescue} onChange={event => setSelectedRescue(event.target.value)}><option value="">Choose booking or route</option>{myBookings.filter(b => b.status === 'Upcoming').map(b => <option key={b.id} value={b.id}>{b.reference} — {data.routes.find(r => r.id === b.routeId)?.name}</option>)}</select></div><div className="field"><label htmlFor="rescue-route">Route</label><select id="rescue-route" value={routeId} onChange={event => setRouteId(event.target.value)}>{activeRoutes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div></div><div className="field"><label htmlFor="rescue-category">Disruption category</label><select id="rescue-category" value={rescueCategory} onChange={event => setRescueCategory(event.target.value)}><option>Breakdown</option><option>Service delay</option><option>Missed connection</option><option>Accessibility support</option><option>Other</option></select></div><label className="row small" style={{ justifyContent: 'flex-start', margin: '7px 0 12px' }}><input type="checkbox" checked={replacementRequested} onChange={event => setReplacementRequested(event.target.checked)} /> Request replacement transport if available</label><div className="field"><label htmlFor="rescue-description">What happened?</label><textarea id="rescue-description" {...rescueForm.register('description')} placeholder="Describe what you can see and where you are." data-testid="input-rescue-description" />{rescueForm.formState.errors.description && <span className="small" style={{ color: '#a63838' }}>{rescueForm.formState.errors.description.message}</span>}</div><button className="btn btn-primary" type="submit" data-testid="button-submit-rescue"><Send size={15} /> Submit rescue request</button></form></div>;

  let body: ReactNode;
  if (routeMatch) {
    const route = routeDetails;
    body = route ? <><PageHead title={route.name} text="Route itinerary, schedule, and vehicle details. Sample data only." action={<button className="btn btn-primary" onClick={() => onBook(route)}>Book this journey <ArrowRight size={15} /></button>} /><div className="grid grid-2"><section className="panel"><div className="row"><h2>Journey overview</h2><Badge>{route.status}</Badge></div><div className="route-stops" style={{ margin: '25px 0' }}><span><strong>{route.schedule.departure}</strong><br />{route.origin}</span><ArrowRight /><span><strong>{route.schedule.arrival}</strong><br />{route.destination}</span></div><div className="grid grid-2"><div><span className="small muted">Estimated duration</span><div><strong>{route.duration} minutes</strong></div></div><div><span className="small muted">Vehicle</span><div><strong>{data.buses.find(b => b.id === route.busId)?.name ?? 'Unassigned'}</strong></div></div><div><span className="small muted">Available seats</span><div><strong>{data.buses.find(b => b.id === route.busId)?.available ?? 0} / {data.buses.find(b => b.id === route.busId)?.capacity ?? '—'}</strong></div></div><div><span className="small muted">Accessibility</span><div><strong>{route.accessible ? 'Step-free boarding' : 'Standard boarding'}</strong></div></div></div><div className="notice" style={{ marginTop: 20 }}>Schedules and seat availability are illustrative demo values and are not a live reservation.</div></section><section className="panel"><h2>Stops along the way</h2><div className="timeline">{route.stops.sort((a, b) => a.sequence - b.sequence).map(stop => <div className="timeline-item" key={stop.id}><strong>{stop.name}</strong><div className="small muted">{stop.time} · Stop {stop.sequence}</div></div>)}</div></section>      <section className="panel">
        <div className="row" style={{ marginBottom: 12 }}>
          <h2>Route map</h2>
          <Badge>Google Maps Navigation</Badge>
        </div>
        <GoogleMapViewer
          origin={route.origin}
          destination={route.destination}
          stops={route.stops}
          height={320}
        />
        <p className="small muted" style={{ marginTop: 10 }}>Interactive live transit route powered by Google Maps.</p>
      </section><section className="panel"><h2>Schedule</h2><div className="row"><div><strong>{route.schedule.departure}</strong><div className="small muted">Departure</div></div><div><strong>{route.schedule.arrival}</strong><div className="small muted">Arrival estimate</div></div></div><p className="small muted">Runs: {route.schedule.days.join(', ')}</p><button className="btn btn-primary" onClick={() => onBook(route)}>Book seat</button></section></div></> : <div className="panel empty"><MapPin /><h2>Route not found</h2><Link href="/student/buses" className="btn btn-primary">Browse buses</Link></div>;
  } else if (pageKey === 'dashboard' && role === 'student') {
    const upcoming = myBookings.find(b => b.status === 'Upcoming');
    const bookedRoute = upcoming && data.routes.find(r => r.id === upcoming.routeId);
    body = <><PageHead title={`Good morning, ${user?.name.split(' ')[0] ?? 'traveller'}`} text="A clear view of what is next on your campus journey." action={<Link href="/student/planner" className="btn btn-primary"><Compass size={15} /> Plan a journey</Link>} />{demoNotice}<div className="grid grid-4"><Stat label="Upcoming journeys" value={myBookings.filter(b => b.status === 'Upcoming').length} hint="Across your demo bookings" icon={<CalendarDays size={16} />} /><Stat label="Routes available" value={activeRoutes.length} hint="Sample campus services" icon={<RouteIcon size={16} />} /><Stat label="Open rescue cases" value={data.rescues.filter(r => r.userId === userId && r.status !== 'Resolved').length} hint="Request status follows admin updates" icon={<ShieldCheck size={16} />} /><Stat label="Unread updates" value={myNotifications.filter(n => !n.read).length} hint="Local prototype notifications" icon={<Bell size={16} />} /></div><div className="grid grid-2" style={{ marginTop: 16 }}><div className="panel"><div className="row"><h2>Your next journey</h2><Badge>{upcoming ? 'Upcoming' : 'No booking'}</Badge></div>{bookedRoute ? <><div className="route-stops" style={{ margin: '25px 0 20px' }}><span><strong>{bookedRoute.schedule.departure}</strong><br />{bookedRoute.origin}</span><ArrowRight /><span><strong>{bookedRoute.schedule.arrival}</strong><br />{bookedRoute.destination}</span></div><p className="small muted">{bookedRoute.name} · {upcoming?.date} · Ref {upcoming?.reference}</p><div className="row" style={{ justifyContent: 'flex-start' }}><Link href="/student/tracking" className="btn btn-primary btn-small">View journey status</Link><Link href="/student/bookings" className="btn btn-outline btn-small">Booking details</Link></div></> : <div className="empty"><CalendarDays /><p>No upcoming journey booked.</p><Link href="/student/buses" className="btn btn-primary">Find a bus</Link></div>}</div><div className="panel"><div className="row"><h2>Quick help</h2><ShieldCheck color="#247653" /></div><p className="muted small">If a route is disrupted, let the transport team know. Your request stays open until reviewed and a replacement is assigned.</p><Link href="/student/rescue" className="btn btn-soft">Open Journey Rescue <ArrowRight size={14} /></Link><div className="notice warn" style={{ marginTop: 14 }}>For urgent danger, use your local emergency number directly. This prototype does not dispatch help.</div></div><div className="panel"><div className="row"><h2>Route availability</h2><Link href="/student/buses" className="small" style={{ color: '#247653' }}>Browse routes</Link></div>{activeRoutes.slice(0, 3).map(r => <div className="row" key={r.id} style={{ padding: '11px 0', borderBottom: '1px solid #edf1ec' }}><div><strong className="small">{r.name}</strong><div className="small muted">{r.origin} to {r.destination}</div></div><Badge>{data.buses.find(b => b.id === r.busId)?.available} seats</Badge></div>)}</div><div className="panel"><div className="row"><h2>Demand pulse</h2><Badge>DEMO DATA</Badge></div><p className="small muted">North Loop is carrying moderate sample demand this morning.</p><div style={{ height: 120 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={[{ name: '7–8', demand: 42 }, { name: '8–9', demand: 77 }, { name: '9–10', demand: 58 }, { name: '10–11', demand: 35 }]}><Bar dataKey="demand" fill="#247653" radius={[4, 4, 0, 0]} /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><Tooltip /></BarChart></ResponsiveContainer></div></div></div></>;
  } else if (pageKey === 'buses' || pageKey === 'planner') {
    const planner = pageKey === 'planner';
    body = <><PageHead title={planner ? 'Find a journey that fits' : 'Find your campus bus'} text={planner ? 'Set your preferences to compare sample campus routes.' : 'Search departures, compare access features, and book in the local demo.'} />{demoNotice}<div className="panel" style={{ marginBottom: 16 }}><div className="field"><label htmlFor="route-search">Search routes and stops</label><input id="route-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search route or stop name" data-testid="input-search-routes" /></div><div className="form-grid"><div className="field"><label htmlFor="origin">From</label><input id="origin" value={origin} onChange={e => setOrigin(e.target.value)} placeholder="Origin or stop name" data-testid="input-origin" /></div><div className="field"><label htmlFor="destination">To</label><input id="destination" value={destination} onChange={e => setDestination(e.target.value)} placeholder="Destination" data-testid="input-destination" /></div><div className="field"><label htmlFor="departure-date">Travel date</label><input id="departure-date" type="date" min={dateNow()} value={date} onChange={e => setDate(e.target.value)} /></div><div className="field"><label htmlFor="departure-time">Preferred departure</label><select id="departure-time" value={preferredTime} onChange={e => setPreferredTime(e.target.value)}><option value="">Any time</option><option value="early">Before 09:00</option><option value="midday">09:00–12:00</option><option value="late">After 12:00</option></select></div></div><div className="row" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}><label className="row small" style={{ justifyContent: 'flex-start', cursor: 'pointer' }}><input type="checkbox" checked={filterAccess} onChange={e => setFilterAccess(e.target.checked)} /> Step-free accessible route</label>{planner && <><label className="row small"><input type="checkbox" checked={wheelchairPref} onChange={e => setWheelchairPref(e.target.checked)} /> Wheelchair space</label><label className="row small"><input type="checkbox" checked={lowStepPref} onChange={e => setLowStepPref(e.target.checked)} /> Low-step boarding</label></>}<button className="btn btn-primary btn-small" onClick={() => flash(`${filteredRoutes.length} suitable sample routes found.`)}><Search size={14} /> Search journeys</button><button className="btn btn-outline btn-small" onClick={() => { setQuery(''); setOrigin(''); setDestination(''); setFilterAccess(false); setWheelchairPref(false); setLowStepPref(false); setPreferredTime(''); }}>Clear filters</button></div></div>{planner && savedPlans.length > 0 && <section className="panel" style={{ marginBottom: 18 }}><div className="row"><h2>Saved plans</h2><Badge>Saved on this device</Badge></div>{savedPlans.map(plan => { const route = data.routes.find(item => item.id === plan.routeId); return route ? <div className="row" key={plan.routeId} style={{ padding: '10px 0', borderBottom: '1px solid #edf1ec' }}><div><strong>{route.name}</strong><div className="small muted">{route.origin} to {route.destination} · {plan.date}</div></div><div className="row"><Link href={`/student/routes/${route.id}`} className="btn btn-outline btn-small">Review</Link><button className="btn btn-danger btn-small" onClick={() => removeSavedPlan(route.id)}>Remove</button></div></div> : null; })}</section>}<div className="row" style={{ marginBottom: 12 }}><h2 style={{ fontSize: 18 }}>Suitable journeys</h2><span className="small muted">{filteredRoutes.length} sample routes</span></div>{filteredRoutes.length ? <div className="stack">{filteredRoutes.map(route => <RouteCard route={route} key={route.id} />)}</div> : <div className="panel empty"><Search /><strong>No routes match those filters</strong><p className="small">Try a stop name, destination, or remove the accessibility filter.</p></div>}</>;
  } else if (pageKey === 'bookings') {
    const list = role === 'admin' ? data.bookings : myBookings;
    body = <><PageHead title={role === 'admin' ? 'Booking management' : 'My bookings'} text="Review booking references and manage upcoming demo journeys." action={<Link href="/student/buses" className="btn btn-primary"><Plus size={15} /> Find a journey</Link>} />{demoNotice}<div className="panel"><div className="table-wrap"><table><thead><tr><th>Reference</th><th>Route</th><th>Travel date</th><th>Vehicle</th><th>Status</th><th>Action</th></tr></thead><tbody>{list.map(b => { const r = data.routes.find(item => item.id === b.routeId); return <tr key={b.id}><td><strong>{b.reference}</strong></td><td>{r?.name ?? 'Removed route'}<div className="small muted">{r?.origin} → {r?.destination}</div></td><td>{b.date}</td><td>{data.buses.find(item => item.id === b.busId)?.name ?? '—'}</td><td><Badge tone={b.status === 'Cancelled' ? 'gray' : ''}>{b.status}</Badge></td><td>{b.status === 'Upcoming' && <button className="btn btn-danger btn-small" onClick={() => setConfirmBooking(b.id)} data-testid={`button-cancel-${b.id}`}>Cancel</button>}</td></tr>; })}</tbody></table></div>{!list.length && <div className="empty"><ClipboardList /><p>No bookings yet. Find a route to get started.</p><Link href="/student/buses" className="btn btn-primary">Browse buses</Link></div>}</div>{confirmBooking && <Confirm title="Cancel this booking?" text="The demo seat will be returned to the route. This cannot be undone." confirmLabel="Cancel booking" onCancel={() => setConfirmBooking('')} onConfirm={() => onCancelBooking(confirmBooking)} />}</>;
  } else if (pageKey === 'tracking') {
    const upcoming = myBookings.find(b => b.status === 'Upcoming');
    const tracked = data.routes.find(r => r.id === upcoming?.routeId) ?? myRoute;
    const journey = data.journeys.find(j => j.routeId === tracked.id);
    body = (
      <>
        <PageHead title="Live tracking & navigation" text="Real-time map and scheduled stop progress along your campus journey." />
        {demoNotice}
        <div className="grid grid-2">
          <div className="panel">
            <div className="row" style={{ marginBottom: 12 }}>
              <h2>{tracked.name}</h2>
              <Badge>{journey?.status ?? 'Scheduled'}</Badge>
            </div>
            <GoogleMapViewer
              origin={tracked.origin}
              destination={tracked.destination}
              stops={tracked.stops}
              height={380}
            />
            <p className="small muted" style={{ marginTop: 10 }}>
              Live Google Maps route showing origin ({tracked.origin}) to destination ({tracked.destination}).
            </p>
          </div>
          <div className="panel">
            <h2>Journey updates</h2>
            <div className="timeline">
              {tracked.stops.map((stop, index) => (
                <div className="timeline-item" key={stop.id}>
                  <strong>{stop.name}</strong>
                  <div className="small muted">
                    Scheduled time {stop.time} · {index === 0 ? journey?.status ?? 'Scheduled' : 'Upcoming'}
                  </div>
                </div>
              ))}
            </div>
            <Link href="/student/safety" className="btn btn-soft">Open journey safety</Link>
          </div>
        </div>
      </>
    );
  } else if (pageKey === 'rescue' && role !== 'admin' && role !== 'driver') {
    body = <><PageHead title="Journey Rescue" text="Report a disruption and follow the transport team's response." />{demoNotice}<div className="grid grid-2">{rescueFormBlock}<section className="panel"><h2>Your rescue cases</h2><p className="small muted">A case remains open until a replacement is assigned and the team updates its status.</p>{myRescues.length ? <div className="stack">{myRescues.map(r => <div className="panel" key={r.id} style={{ padding: 15 }}><div className="row"><strong>{r.category}</strong><Badge tone={r.status === 'Resolved' ? '' : r.status === 'Submitted' ? 'amber' : ''}>{r.status}</Badge></div><p className="small muted">{data.routes.find(route => route.id === r.routeId)?.name} · {new Date(r.createdAt).toLocaleString()}</p><p className="small">{r.description}</p>{r.replacementBusId && <div className="notice">Replacement vehicle assigned: {data.buses.find(b => b.id === r.replacementBusId)?.name}</div>}<div className="small muted" style={{ marginTop: 8 }}>{r.notes[0]}</div></div>)}</div> : <div className="empty"><ShieldCheck /><p>No rescue cases. We hope your journeys run smoothly.</p></div>}</section></div></>;
  } else if (pageKey === 'rescue' && role === 'admin') {
    body = <><PageHead title="Journey Rescue desk" text="Review disruptions and coordinate replacement vehicles from the available fleet." />{demoNotice}<div className="grid grid-3"><Stat label="Open cases" value={data.rescues.filter(r => !['Resolved', 'Closed'].includes(r.status)).length} hint="Awaiting a team update" icon={<TriangleAlert size={16} />} /><Stat label="Replacement requested" value={data.rescues.filter(r => r.status === 'Submitted' || r.status === 'Replacement Requested').length} hint="Cases without assignment" icon={<BusFront size={16} />} /><Stat label="Available replacements" value={data.buses.filter(b => b.status === 'Available').length} hint="Checked before assignment" icon={<CheckCircle2 size={16} />} /></div><div className="stack" style={{ marginTop: 16 }}>{data.rescues.length ? data.rescues.map(r => <div className="panel" key={r.id}><div className="row"><div><div className="row" style={{ justifyContent: 'flex-start' }}><h2 style={{ marginBottom: 5 }}>{r.category} report</h2><Badge tone={r.status === 'Submitted' ? 'amber' : ''}>{r.status}</Badge></div><div className="small muted">{r.id} · {r.source} · {data.routes.find(route => route.id === r.routeId)?.name ?? 'Route not found'} · {new Date(r.createdAt).toLocaleString()}</div></div><span className="tag">{r.source} report</span></div><p>{r.description}</p><div className="row" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>{r.replacementBusId ? <><div className="notice">Replacement assigned: <strong>{data.buses.find(b => b.id === r.replacementBusId)?.name}</strong></div>{r.status !== 'Resolved' && <button className="btn btn-primary btn-small" onClick={() => { updateRescueStatus(r.id, 'Resolved', 'Case resolved after replacement assignment.'); setData(readData()); flash('Case marked resolved after replacement assignment.'); }}>Mark resolved</button>}</> : <><select aria-label="Available replacement bus" value={selectedRescue === r.id ? replacement : ''} onChange={e => { setSelectedRescue(r.id); setReplacement(e.target.value); }}><option value="">Choose available bus</option>{data.buses.filter(b => b.status === 'Available').map(b => <option key={b.id} value={b.id}>{b.name} · {b.available} seats</option>)}</select><button className="btn btn-primary btn-small" onClick={() => { if (selectedRescue !== r.id) { setSelectedRescue(r.id); flash('Select an available bus for this case.'); } else assign(); }} data-testid={`button-assign-${r.id}`}>Assign replacement</button><button className="btn btn-outline btn-small" onClick={() => { updateRescueStatus(r.id, 'Under Review', 'Case reviewed by transport admin.'); setData(readData()); flash('Case moved to Under Review.'); }}>Mark under review</button></>}</div><div className="small muted" style={{ marginTop: 10 }}>Latest case note: {r.notes[0]}</div></div>) : <div className="panel empty"><ShieldCheck /><strong>Rescue desk is clear</strong><p className="small">New student and driver requests will appear here.</p></div>}</div></>;
  } else if (pageKey === 'rescue' && role === 'driver') {
    body = <><PageHead title="Report a breakdown" text="Create an incident and linked rescue request for the transport team." />{demoNotice}<div className="grid grid-2"><div className="panel"><h2>Incident report</h2><div className="notice warn">This is a local demo report only. It does not contact roadside services or emergency dispatch.</div><div className="field"><label>Assigned vehicle</label><input value={`${data.buses.find(b => b.id === myRoute.busId)?.name ?? '—'} · ${data.buses.find(b => b.id === myRoute.busId)?.plate ?? ''}`} readOnly /></div><div className="field"><label>Assigned route</label><input value={myRoute.name} readOnly /></div><div className="field"><label htmlFor="driver-incident">Describe the issue</label><textarea id="driver-incident" value={rescueDescription} onChange={e => setRescueDescription(e.target.value)} placeholder="What happened? Include a safe location description." /></div>{incidentError && <p className="small" style={{ color: '#a63838' }}>{incidentError}</p>}<button className="btn btn-primary" onClick={submitDriverIncident}><TriangleAlert size={15} /> Submit incident</button></div><div className="panel"><h2>Previous incidents</h2>{driverIncidents.length ? <div className="stack">{driverIncidents.map(i => <div key={i.id} className="panel" style={{ padding: 14 }}><div className="row"><strong>{i.category}</strong><Badge>{i.status}</Badge></div><p className="small muted">{data.routes.find(r => r.id === i.routeId)?.name} · {new Date(i.createdAt).toLocaleString()}</p><p className="small">{i.description}</p><p className="small muted">Rescue case: {data.rescues.find(r => r.id === i.rescueId)?.status ?? 'Submitted'}</p></div>)}</div> : <div className="empty"><CheckCircle2 /><p>No incidents reported in this demo.</p></div>}</div></div></>;
  } else if (pageKey === 'safety' && role === 'student') {
    body = <><PageHead title="Journey safety" text="Useful check-in information and a locally saved trusted contact." />{demoNotice}<div className="grid grid-2"><section className="panel"><h2>Before you travel</h2><div className="stack">{['Check your route and boarding stop', 'Keep your booking reference available', 'Share your plans with someone you trust', 'Stay aware of your surroundings'].map(item => <label className="row" key={item} style={{ justifyContent: 'flex-start', padding: '10px 0', borderBottom: '1px solid #edf1ec' }}><input type="checkbox" />{item}</label>)}</div><button className="btn btn-primary" style={{ marginTop: 17 }} onClick={() => { setSafetyCheck(!safetyCheck); flash(safetyCheck ? 'Check-in cleared locally.' : 'Journey check-in saved on this device.'); }}>{safetyCheck ? <CheckCircle2 size={15} /> : <Check size={15} />}{safetyCheck ? 'Journey checked in' : 'Check in for this journey'}</button></section><section className="panel"><h2>Trusted contact</h2><p className="small muted">Saved on this device only. This prototype will not message or call your contact.</p><div className="field"><label htmlFor="trusted-name">Contact name</label><input id="trusted-name" placeholder="Name" /></div><div className="field"><label htmlFor="trusted-phone">Contact phone</label><input id="trusted-phone" type="tel" placeholder="Phone number" /></div><button className="btn btn-outline" onClick={() => flash('Trusted contact details saved locally for this session.')}>Save contact details</button><div className="notice warn" style={{ marginTop: 15 }}><strong>Need urgent help?</strong> Call your local emergency number directly. No message is sent and no emergency service is contacted from RouteRakshak.</div><Link href="/student/rescue" className="btn btn-soft" style={{ marginTop: 15 }}>Report a journey incident</Link></section></div></>;
  } else if ((pageKey === 'dashboard' || pageKey === 'route' || pageKey === 'journey') && role === 'driver') {
    const journey = data.journeys.find(j => j.routeId === myRoute.id);
    body = (
      <>
        <PageHead
          title={pageKey === 'dashboard' ? 'Driver dashboard' : pageKey === 'route' ? 'Assigned route' : 'Journey status'}
          text="Your route workspace with live navigation and transit actions."
          action={<Link href="/driver/incidents" className="btn btn-outline"><TriangleAlert size={15} /> Report incident</Link>}
        />
        {demoNotice}
        <div className="grid grid-3">
          <Stat label="Assigned vehicle" value={data.buses.find(b => b.id === myRoute.busId)?.name ?? '—'} hint={data.buses.find(b => b.id === myRoute.busId)?.plate ?? 'Sample fleet vehicle'} icon={<BusFront size={16} />} />
          <Stat label="Route" value={myRoute.name} hint={`${myRoute.origin} → ${myRoute.destination}`} icon={<RouteIcon size={16} />} />
          <Stat label="Journey status" value={journey?.status ?? 'Scheduled'} hint="Change status using valid transitions below" icon={<Activity size={16} />} />
        </div>
        <div className="grid grid-2" style={{ marginTop: 16 }}>
          <section className="panel">
            <div className="row">
              <h2>{myRoute.name}</h2>
              <Badge>{journey?.status ?? 'Scheduled'}</Badge>
            </div>
            <p className="small muted">Departure {myRoute.schedule.departure} · {myRoute.stops.length} stops · {myRoute.duration} minutes scheduled</p>
            <div style={{ margin: '14px 0' }}>
              <GoogleMapViewer
                origin={myRoute.origin}
                destination={myRoute.destination}
                stops={myRoute.stops}
                height={280}
              />
            </div>
            <div className="timeline">
              {myRoute.stops.map((stop, index) => (
                <div className="timeline-item" key={stop.id}>
                  <strong>{stop.name}</strong>
                  <div className="small muted">{stop.time} {index === journey?.completedStops ? '· Next stop' : ''}</div>
                </div>
              ))}
            </div>
            <Link href="/driver/route" className="btn btn-outline btn-small">Open route details</Link>
          </section>
          <section className="panel">
            <h2>Journey actions</h2>
            <p className="small muted">Only valid next statuses are accepted.</p>
            <div className="stack">
              {(['Boarding', 'In Transit', 'Delayed', 'Completed'] as const).map(status => (
                <button className="btn btn-outline" key={status} onClick={() => updateJourney(status)}>
                  {status === 'Completed' ? <CheckCircle2 size={15} /> : <Activity size={15} />} Mark {status}
                </button>
              ))}
            </div>
            <div className="notice warn" style={{ marginTop: 18 }}>If there is a breakdown, report an incident. The admin will see a linked rescue case.</div>
            <Link href="/driver/incidents" className="btn btn-primary" style={{ marginTop: 13 }}>Report breakdown</Link>
          </section>
        </div>
      </>
    );
  } else if (pageKey === 'incidents' && role === 'driver') {
    body = <><PageHead title="Incidents and breakdowns" text="Report a disruption and follow its status in the shared local demo store." /><div className="grid grid-2"><div className="panel"><h2>New breakdown report</h2><div className="notice warn">Prototype only. No roadside assistance, SMS, or emergency dispatch is contacted.</div><div className="field"><label>Bus and route</label><input readOnly value={`${data.buses.find(b => b.id === myRoute.busId)?.name ?? 'Bus'} · ${myRoute.name}`} /></div><div className="field"><label htmlFor="driver-incident-two">Issue details</label><textarea id="driver-incident-two" value={rescueDescription} onChange={e => setRescueDescription(e.target.value)} placeholder="Describe the issue (at least 8 characters)" /></div>{incidentError && <div className="small" style={{ color: '#a63838' }}>{incidentError}</div>}<button className="btn btn-primary" onClick={submitDriverIncident}><Send size={15} /> Submit incident</button></div><div className="panel"><h2>Incident history</h2>{driverIncidents.map(i => <div className="panel" key={i.id} style={{ padding: 14, marginBottom: 10 }}><div className="row"><strong>{i.category}</strong><Badge>{data.rescues.find(r => r.id === i.rescueId)?.status ?? i.status}</Badge></div><p className="small muted">{i.description}</p></div>)}{!driverIncidents.length && <div className="empty"><CheckCircle2 /><p>No reported incidents.</p></div>}</div></div></>;
  } else if (pageKey === 'dashboard' && role === 'admin') {
    body = <><PageHead title="Transport operations" text="A shared view of the campus fleet, service, and open assistance cases." action={<Link href="/admin/rescue" className="btn btn-primary"><ShieldCheck size={15} /> Review rescue desk</Link>} />{demoNotice}<div className="grid grid-4"><Stat label="Active buses" value={data.buses.filter(b => b.status !== 'Maintenance').length} hint={`${data.buses.filter(b => b.status === 'Available').length} available as replacements`} icon={<BusFront size={16} />} /><Stat label="Active routes" value={activeRoutes.length} hint="Sample campus service" icon={<RouteIcon size={16} />} /><Stat label="Bookings" value={data.bookings.filter(b => b.status === 'Upcoming').length} hint="Upcoming demo reservations" icon={<ClipboardList size={16} />} /><Stat label="Open rescue cases" value={data.rescues.filter(r => !['Resolved', 'Closed'].includes(r.status)).length} hint="Review and coordinate next steps" icon={<TriangleAlert size={16} />} /></div><div className="grid grid-2" style={{ marginTop: 16 }}><section className="panel"><div className="row"><h2>Route demand</h2><Badge>DEMO DATA</Badge></div><div style={{ height: 250 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={data.routes.map((r, i) => ({ name: r.name.replace(' ', '\\n'), occupancy: [64, 48, 39][i % 3], available: data.buses.find(b => b.id === r.busId)?.available ?? 0 }))}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6ece5" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="occupancy" name="Sample occupancy %" fill="#247653" radius={[4, 4, 0, 0]} /><Bar dataKey="available" name="Seats available" fill="#a8cdb2" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></section><section className="panel"><div className="row"><h2>Fleet availability</h2><Link href="/admin/fleet" className="small" style={{ color: '#247653' }}>Manage fleet</Link></div><div style={{ height: 200 }}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{ name: 'Assigned', value: data.buses.filter(b => b.status === 'Assigned').length }, { name: 'Available', value: data.buses.filter(b => b.status === 'Available').length }, { name: 'Maintenance', value: data.buses.filter(b => b.status === 'Maintenance').length }]} dataKey="value" innerRadius={50} outerRadius={78} paddingAngle={4}>{['#174D38', '#8ab997', '#d99525'].map((color, i) => <Cell key={i} fill={color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div><div className="row small"><span>Assigned {data.buses.filter(b => b.status === 'Assigned').length}</span><span>Available {data.buses.filter(b => b.status === 'Available').length}</span><span>Maintenance {data.buses.filter(b => b.status === 'Maintenance').length}</span></div></section><section className="panel"><div className="row"><h2>Recent incidents</h2><Link href="/admin/rescue" className="small" style={{ color: '#247653' }}>Rescue desk</Link></div>{data.rescues.slice(0, 4).map(r => <div className="row" key={r.id} style={{ padding: '11px 0', borderBottom: '1px solid #edf1ec' }}><div><strong className="small">{r.category}</strong><div className="small muted">{data.routes.find(route => route.id === r.routeId)?.name}</div></div><Badge tone={r.status === 'Submitted' ? 'amber' : ''}>{r.status}</Badge></div>)}{!data.rescues.length && <p className="small muted">No new disruptions. Incoming cases appear here.</p>}</section><section className="panel"><h2>Operations shortcuts</h2><div className="grid grid-2"><Link href="/admin/fleet" className="btn btn-outline"><BusFront size={15} /> Fleet</Link><Link href="/admin/routes" className="btn btn-outline"><RouteIcon size={15} /> Routes</Link><Link href="/admin/bookings" className="btn btn-outline"><ClipboardList size={15} /> Bookings</Link><Link href="/admin/analytics" className="btn btn-outline"><Activity size={15} /> Analytics</Link></div></section></div></>;
  } else if (pageKey === 'fleet' && role === 'admin') {
    body = <><PageHead title="Fleet management" text="Add vehicles, update details, and manage replacement availability." action={<button className="btn btn-primary" onClick={() => { setEditId(''); setBusName(''); setBusPlate(''); setBusCapacity('36'); setBusAccessible(true); setFormOpen(true); }}><Plus size={15} /> Add bus</button>} />{demoNotice}{formOpen && <div className="panel" style={{ marginBottom: 16 }}><div className="row"><h2>{editId ? 'Edit vehicle' : 'Add a vehicle'}</h2><button className="btn btn-outline btn-small" onClick={() => setFormOpen(false)}><X size={14} /> Close</button></div><div className="form-grid"><div className="field"><label htmlFor="bus-name">Vehicle name</label><input id="bus-name" value={busName} onChange={e => setBusName(e.target.value)} placeholder="e.g. Orchard 05" /></div><div className="field"><label htmlFor="bus-plate">Registration</label><input id="bus-plate" value={busPlate} onChange={e => setBusPlate(e.target.value)} placeholder="Demo vehicle registration" /></div><div className="field"><label htmlFor="bus-capacity">Seat capacity</label><input id="bus-capacity" type="number" min="1" value={busCapacity} onChange={e => setBusCapacity(e.target.value)} /></div><label className="row small" style={{ justifyContent: 'flex-start' }}><input type="checkbox" checked={busAccessible} onChange={e => setBusAccessible(e.target.checked)} /> Accessible boarding</label></div><button className="btn btn-primary" onClick={saveBus}><SaveIcon /> {editId ? 'Save vehicle' : 'Add vehicle'}</button></div>}<div className="panel"><div className="table-wrap"><table><thead><tr><th>Vehicle</th><th>Registration</th><th>Route assignment</th><th>Seats available</th><th>Access</th><th>Status</th><th>Actions</th></tr></thead><tbody>{data.buses.map(bus => <tr key={bus.id}><td><strong>{bus.name}</strong><div className="small muted">{bus.capacity} seats capacity</div></td><td>{bus.plate}</td><td>{data.routes.find(r => r.id === bus.routeId)?.name ?? 'Unassigned'}</td><td>{bus.available}</td><td>{bus.accessible ? 'Step-free' : 'Standard'}</td><td><Badge tone={bus.status === 'Maintenance' ? 'red' : bus.status === 'Available' ? '' : 'gray'}>{bus.status}</Badge></td><td><button className="btn btn-outline btn-small" onClick={() => editBus(bus.id)}><Pencil size={13} /> Edit</button> <button className="btn btn-outline btn-small" onClick={() => toggleBus(bus.id)}>{bus.status === 'Maintenance' ? 'Mark available' : 'Maintenance'}</button></td></tr>)}</tbody></table></div></div></>;
  } else if (pageKey === 'routes' && role === 'admin') {
    body = <><PageHead title="Route management" text="Create and edit a service by assigning an existing available vehicle." action={<button className="btn btn-primary" onClick={() => { setEditId(''); setBusName(''); setOrigin(''); setDestination(''); setRouteId(data.buses.find(b => b.status === 'Available')?.id ?? ''); setFormOpen(!formOpen); }}><Plus size={15} /> Add route</button>} />{demoNotice}{formOpen && <div className="panel" style={{ marginBottom: 16 }}><h2>{editId ? 'Edit campus route' : 'New campus route'}</h2><div className="form-grid"><div className="field"><label htmlFor="route-name">Route name</label><input id="route-name" value={busName} onChange={e => setBusName(e.target.value)} placeholder="e.g. West Residence Link" /></div><div className="field"><label htmlFor="route-bus">Available vehicle</label><select id="route-bus" value={routeId} onChange={e => setRouteId(e.target.value)}>{data.buses.filter(b => b.status === 'Available' || b.id === routeId).map(b => <option key={b.id} value={b.id}>{b.name} · {b.status.toLowerCase()}</option>)}</select></div><div className="field"><label htmlFor="route-origin">Origin</label><input id="route-origin" value={origin} onChange={e => setOrigin(e.target.value)} placeholder="Stop name" /></div><div className="field"><label htmlFor="route-destination">Destination</label><input id="route-destination" value={destination} onChange={e => setDestination(e.target.value)} placeholder="Stop name" /></div></div><button className="btn btn-primary" onClick={addRoute}>{editId ? 'Save route changes' : 'Create route and assign vehicle'}</button><button className="btn btn-outline" style={{ marginLeft: 8 }} onClick={() => setFormOpen(false)}>Cancel</button><p className="small muted">Route assignment is blocked unless a real available bus is selected from the demo fleet.</p></div>}<div className="panel"><div className="table-wrap"><table><thead><tr><th>Route</th><th>From / to</th><th>Stops</th><th>Schedule</th><th>Bus</th><th>Status</th><th>Action</th></tr></thead><tbody>{data.routes.map(r => <tr key={r.id}><td><strong>{r.name}</strong><div className="small muted">{r.duration} min estimated</div></td><td>{r.origin} → {r.destination}</td><td>{r.stops.length}</td><td>{r.schedule.departure} – {r.schedule.arrival}</td><td>{data.buses.find(b => b.id === r.busId)?.name ?? 'None'}</td><td><Badge>{r.status}</Badge></td><td><button className="btn btn-outline btn-small" onClick={() => editRoute(r)}><Pencil size={13} /> Edit</button> <button className="btn btn-outline btn-small" onClick={() => toggleRouteStatus(r.id)}>{r.status === 'Active' ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table></div></div></>;
  } else if (pageKey === 'stops' && role === 'admin') {
    body = (
      <>
        <PageHead
          title="Stop management"
          text="Organize campus stops, sequence order, and scheduled times across routes."
          action={
            <button
              className="btn btn-primary"
              onClick={() => {
                setStopRouteId(data.routes[0]?.id ?? '');
                setStopName('');
                setStopTime('08:00');
                setStopFormOpen(!stopFormOpen);
              }}
            >
              <Plus size={15} /> Add stop
            </button>
          }
        />
        {demoNotice}

        {stopFormOpen && (
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="row" style={{ marginBottom: 12 }}>
              <h2>Add a new campus stop</h2>
              <button className="btn btn-outline btn-small" onClick={() => setStopFormOpen(false)}>
                <X size={14} /> Close
              </button>
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="stop-route-select">Select Route</label>
                <select
                  id="stop-route-select"
                  value={stopRouteId || (data.routes[0]?.id ?? '')}
                  onChange={e => setStopRouteId(e.target.value)}
                >
                  {data.routes.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.origin} → {r.destination})
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="stop-name-input">Stop Name</label>
                <input
                  id="stop-name-input"
                  value={stopName}
                  onChange={e => setStopName(e.target.value)}
                  placeholder="e.g. Science Block, Gate 4"
                />
              </div>
              <div className="field">
                <label htmlFor="stop-time-input">Scheduled Time</label>
                <input
                  id="stop-time-input"
                  type="time"
                  value={stopTime}
                  onChange={e => setStopTime(e.target.value)}
                />
              </div>
            </div>
            <div className="row" style={{ justifyContent: 'flex-start', gap: 10, marginTop: 12 }}>
              <button className="btn btn-primary" onClick={addStop}>
                <Plus size={15} /> Save stop to route
              </button>
              <button className="btn btn-outline" onClick={() => setStopFormOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-2">
          {data.routes.map(route => (
            <section className="panel" key={route.id}>
              <div className="row" style={{ marginBottom: 16 }}>
                <div>
                  <h2>{route.name}</h2>
                  <div className="small muted">{route.origin} → {route.destination}</div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <Badge>{route.stops.length} stops</Badge>
                  <button
                    className="btn btn-outline btn-small"
                    onClick={() => {
                      setStopRouteId(route.id);
                      setStopName('');
                      setStopTime('08:00');
                      setStopFormOpen(true);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    <Plus size={13} /> Add stop
                  </button>
                </div>
              </div>

              {route.stops.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 45 }}>#</th>
                        <th>Stop Name</th>
                        <th>Scheduled Time</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {route.stops.slice().sort((a, b) => a.sequence - b.sequence).map(stop => (
                        <tr key={stop.id}>
                          <td><strong>{stop.sequence}</strong></td>
                          <td>{stop.name}</td>
                          <td><span className="tag">{stop.time}</span></td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn btn-danger btn-small"
                              style={{ padding: '4px 10px' }}
                              onClick={() => removeStop(route.id, stop.id)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty" style={{ padding: 20 }}>
                  <p className="small muted">No stops on this route yet. Click "Add stop" above to add one.</p>
                </div>
              )}
            </section>
          ))}
        </div>
      </>
    );
  } else if (pageKey === 'drivers' && role === 'admin') {
    body = (
      <>
        <PageHead title="Driver management" text="Review driver assignments, live duty status, and reported incidents." />
        {demoNotice}
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Driver</th>
                  <th>Contact</th>
                  <th>Assigned bus</th>
                  <th>Assigned route</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.drivers.map(driver => (
                  <tr key={driver.id}>
                    <td><strong>{driver.name}</strong></td>
                    <td>{driver.phone}</td>
                    <td>{data.buses.find(b => b.id === driver.busId)?.name ?? 'Unassigned'}</td>
                    <td>{data.routes.find(r => r.id === driver.routeId)?.name ?? 'Unassigned'}</td>
                    <td><Badge tone={driver.status === 'On duty' ? 'green' : driver.status === 'Available' ? '' : 'gray'}>{driver.status}</Badge></td>
                    <td>
                      <button
                        className="btn btn-outline btn-small"
                        onClick={async () => {
                          const next = readData();
                          const item = next.drivers.find(d => d.id === driver.id);
                          if (!item) return;
                          item.status = item.status === 'Off duty' ? 'Available' : item.status === 'Available' ? 'On duty' : 'Off duty';
                          safeWrite(next);
                          if (isSupabaseConfigured()) {
                            await supabaseUpdateDriverStatus(item.id, item.status);
                          }
                          flash(`${item.name} availability updated to ${item.status}.`);
                        }}
                      >
                        Change status
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <section className="panel">
          <div className="row" style={{ marginBottom: 12 }}>
            <h2>Driver Incidents & Breakdowns</h2>
            <Badge>{data.incidents.length} reported</Badge>
          </div>
          {data.incidents.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Driver / Date</th>
                    <th>Vehicle & Route</th>
                    <th>Category</th>
                    <th>Issue Details</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.incidents.map(inc => {
                    const drv = data.drivers.find(d => d.id === inc.driverId);
                    const bus = data.buses.find(b => b.id === inc.busId);
                    const rt = data.routes.find(r => r.id === inc.routeId);
                    return (
                      <tr key={inc.id}>
                        <td>
                          <strong>{drv?.name || inc.driverId}</strong>
                          <div className="small muted">{new Date(inc.createdAt).toLocaleString()}</div>
                        </td>
                        <td>
                          {bus?.name ?? 'Bus'}
                          <div className="small muted">{rt?.name ?? 'Route'}</div>
                        </td>
                        <td><Badge tone="amber">{inc.category}</Badge></td>
                        <td><p className="small" style={{ margin: 0, maxWidth: 320 }}>{inc.description}</p></td>
                        <td><Badge tone={inc.status === 'Resolved' ? '' : 'amber'}>{inc.status}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty" style={{ padding: 24 }}>
              <CheckCircle2 size={24} color="#247653" />
              <p className="small muted" style={{ marginTop: 8 }}>No incidents or breakdowns reported by drivers.</p>
            </div>
          )}
        </section>
      </>
    );
  } else if ((pageKey === 'analytics' || pageKey === 'demand-pulse') && (role === 'admin' || role === 'student')) {
    body = <><PageHead title="Demand pulse" text="Illustrative route demand and occupancy patterns. These are not live predictions." />{demoNotice}<div className="grid grid-3"><Stat label="Sample peak window" value="08:00–09:00" hint="Illustrative weekday sample" icon={<Clock3 size={16} />} /><Stat label="Highest sample occupancy" value="77%" hint="North Loop, 08:00–09:00" icon={<Activity size={16} />} /><Stat label="Seats available now" value={data.buses.reduce((sum, b) => sum + b.available, 0)} hint="Across demo vehicles" icon={<BusFront size={16} />} /></div><div className="grid grid-2" style={{ marginTop: 16 }}><div className="panel"><h2>Sample occupancy by hour</h2><div style={{ height: 280 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={[{ period: '07–08', north: 54, south: 39 }, { period: '08–09', north: 77, south: 68 }, { period: '09–10', north: 57, south: 52 }, { period: '10–11', north: 35, south: 41 }, { period: '11–12', north: 43, south: 36 }]}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6ece5" /><XAxis dataKey="period" tick={{ fontSize: 10 }} /><YAxis unit="%" tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="north" name="North Loop" fill="#174D38" radius={[4, 4, 0, 0]} /><Bar dataKey="south" name="South Connector" fill="#8ab997" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div><div className="panel"><h2>Routes and capacity</h2>{data.routes.map(r => <div className="row" key={r.id} style={{ padding: 14, borderBottom: '1px solid #edf1ec' }}><div><strong>{r.name}</strong><div className="small muted">{r.origin} to {r.destination}</div></div><div style={{ textAlign: 'right' }}><Badge>{data.buses.find(b => b.id === r.busId)?.available ?? 0} available</Badge><div className="small muted" style={{ marginTop: 4 }}>{data.buses.find(b => b.id === r.busId)?.capacity ?? 0} total capacity</div></div></div>)}<div className="notice warn" style={{ marginTop: 15 }}>Values are seeded sample data. No AI model or real-time demand feed is connected.</div></div></div></>;
  } else if (pageKey === 'notifications') {
    body = <><PageHead title="Notifications" text="Updates are local to this browser demo and shared workflow." action={myNotifications.some(n => !n.read) ? <button className="btn btn-outline btn-small" onClick={markAllRead}>Mark all read</button> : undefined} />{demoNotice}<NotificationList /></>;
  } else if (pageKey === 'reports' && role === 'student') {
    body = <><PageHead title="My reports" text="A history of travel support cases created from your account." />{demoNotice}<div className="stack">{myRescues.length ? myRescues.map(r => <div className="panel row" key={r.id}><div><strong>{r.category} · {data.routes.find(route => route.id === r.routeId)?.name}</strong><p className="small muted">{r.description}</p></div><Badge>{r.status}</Badge></div>) : <div className="panel empty"><FileText /><strong>No reports submitted</strong><p className="small">If a journey is disrupted, your case history will appear here.</p><Link href="/student/rescue" className="btn btn-primary">Open Journey Rescue</Link></div>}</div></>;
  } else if (pageKey === 'reports' && role === 'admin') {
    body = <><PageHead title="Operations reports" text="Download-free summaries from current local demo records." />{demoNotice}<div className="grid grid-3"><Stat label="Bookings created" value={data.bookings.length} hint={`${data.bookings.filter(b => b.status === 'Cancelled').length} cancelled`} icon={<ClipboardList size={16} />} /><Stat label="Incidents reported" value={data.incidents.length} hint="Driver incident records" icon={<TriangleAlert size={16} />} /><Stat label="Rescue cases" value={data.rescues.length} hint="Student and driver submissions" icon={<ShieldCheck size={16} />} /></div><section className="panel" style={{ marginTop: 16 }}><h2>Service summary</h2><p className="muted small">Export-ready reporting is not connected in this prototype. These figures reflect locally saved browser demo records.</p><button className="btn btn-outline" onClick={() => { const text = `RouteRakshak demo summary\\nBookings: ${data.bookings.length}\\nRescue cases: ${data.rescues.length}\\nFleet: ${data.buses.length}`; navigator.clipboard?.writeText(text).then(() => flash('Summary copied to clipboard.')).catch(() => flash(text)); }}>Copy summary</button></section></>;
  } else if (pageKey === 'profile') {
    body = <><PageHead title="Your profile" text="Update your local demo profile details." />{demoNotice}<div className="panel" style={{ maxWidth: 700 }}><div className="field"><label htmlFor="profile-name">Display name</label><input id="profile-name" value={profileName} onChange={e => setProfileName(e.target.value)} /></div><div className="field"><label>Email</label><input value={user?.email ?? ''} readOnly /></div><div className="field"><label>Workspace role</label><input value={`${role[0].toUpperCase()}${role.slice(1)} demo`} readOnly /></div>{role === 'student' && <div className="field"><label htmlFor="access-pref">Accessibility preference</label><select id="access-pref"><option>No specific preference</option><option>Wheelchair space</option><option>Low-step boarding</option><option>Quiet ride</option></select></div>}<button className="btn btn-primary" onClick={() => { if (user) { const updated = { ...user, name: profileName.trim() || user.name }; localStorage.setItem('routerakshak-user', JSON.stringify(updated)); setUser(updated); flash('Profile saved locally.'); } }}>Save profile</button></div></>;

  } else if (pageKey === 'support' && role === 'student') {
    body = <><PageHead title="Help & support" text="Clear answers for your campus journey and this prototype." />{demoNotice}<div className="grid grid-2">{[['How do I book?', 'Choose Find a bus, review route details, then select Book seat. A local demo reference is created.'], ['Can I track a live bus?', 'No. The tracking screen is a schematic and does not use live GPS or actual vehicle coordinates.'], ['What if my bus breaks down?', 'Submit a Journey Rescue report. Admin demo users can review the case and assign an available replacement bus.'], ['Does emergency assistance contact anyone?', 'No. For urgent danger, contact local emergency services directly. This prototype does not call, text, or dispatch help.']].map(([q, a]) => <div className="panel" key={q}><h2>{q}</h2><p className="muted small" style={{ lineHeight: 1.7 }}>{a}</p></div>)}</div><div className="notice" style={{ marginTop: 16 }}>Support messages are not delivered externally. Use the role-based demo workspace to explore local workflows.</div></>;
  } else if (role === 'driver' && pageKey === 'history') {
    body = <><PageHead title="Journey history" text="Recent sample journeys and status updates." />{demoNotice}<div className="panel"><div className="table-wrap"><table><thead><tr><th>Date</th><th>Route</th><th>Vehicle</th><th>Departure</th><th>Journey status</th></tr></thead><tbody>{data.journeys.map(j => <tr key={j.id}><td>{j.date}</td><td>{data.routes.find(r => r.id === j.routeId)?.name}</td><td>{data.buses.find(b => b.id === j.busId)?.name}</td><td>{data.routes.find(r => r.id === j.routeId)?.schedule.departure}</td><td><Badge>{j.status}</Badge></td></tr>)}</tbody></table></div></div></>;
  } else {
    body = <><PageHead title={title} text="Your RouteRakshak workspace." />{demoNotice}<div className="panel empty"><CircleHelp /><h2>This workspace section is ready for your next action</h2><p className="small">Use the navigation to explore connected routes, bookings, notifications, and support tools.</p><Link href={`/${role}/dashboard`} className="btn btn-primary">Return to dashboard</Link></div></>;
  }
  return <div className="app-shell"><SideNav /><div className="shell-main"><Header /><main className="main-content">{body}</main></div>{mobileOpen && <button aria-label="Close menu backdrop" onClick={() => setMobileOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 15, border: 0, background: '#10251966' }} />}{toast && <Toast message={toast} onDismiss={() => setToast('')} />}</div>;
}

function SaveIcon() { return <Check size={15} />; }
function Confirm({ title, text, confirmLabel, onCancel, onConfirm }: { title: string; text: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void }) {
  return <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'grid', placeItems: 'center', background: '#10251966', padding: 18 }}><div className="panel" style={{ width: 'min(440px, 100%)', boxShadow: '0 20px 70px #10251930' }}><h2 id="confirm-title">{title}</h2><p className="muted small" style={{ lineHeight: 1.6 }}>{text}</p><div className="row" style={{ justifyContent: 'flex-end', marginTop: 20 }}><button className="btn btn-outline" onClick={onCancel}>Keep booking</button><button className="btn btn-danger" onClick={onConfirm}>{confirmLabel}</button></div></div></div>;
}

function NotFound() {
  return <div className="public-page"><PublicNav /><main className="section" style={{ textAlign: 'center', paddingTop: 120, paddingBottom: 120 }}><div className="feature-icon" style={{ margin: '0 auto 20px' }}><MapPin /></div><div className="eyebrow" style={{ justifyContent: 'center' }}>404 · ROUTE NOT FOUND</div><h1 style={{ color: '#103B2B', fontSize: 48, letterSpacing: '-.05em' }}>This stop is not on the map.</h1><p className="muted">The page may have moved, or the route may not exist in this prototype.</p><Link href="/" className="btn btn-primary" style={{ marginTop: 15 }}>Return home <ArrowRight size={15} /></Link></main></div>;
}

function App() {
  return <Switch>
    <Route path="/" component={PublicPage} />
    <Route path="/features" component={PublicPage} />
    <Route path="/how-it-works" component={PublicPage} />
    <Route path="/about" component={PublicPage} />
    <Route path="/contact" component={PublicPage} />
    <Route path="/login" component={AuthPage} />
    <Route path="/register" component={AuthPage} />
    <Route path="/forgot-password" component={AuthPage} />
    <Route path="/student/dashboard" component={() => <Portal role="student" />} />
    <Route path="/student/buses" component={() => <Portal role="student" />} />
    <Route path="/student/routes/:routeId" component={() => <Portal role="student" />} />
    <Route path="/student/planner" component={() => <Portal role="student" />} />
    <Route path="/student/tracking" component={() => <Portal role="student" />} />
    <Route path="/student/bookings" component={() => <Portal role="student" />} />
    <Route path="/student/rescue" component={() => <Portal role="student" />} />
    <Route path="/student/demand-pulse" component={() => <Portal role="student" />} />
    <Route path="/student/safety" component={() => <Portal role="student" />} />
    <Route path="/student/notifications" component={() => <Portal role="student" />} />
    <Route path="/student/reports" component={() => <Portal role="student" />} />
    <Route path="/student/profile" component={() => <Portal role="student" />} />
    <Route path="/student/support" component={() => <Portal role="student" />} />
    <Route path="/driver/dashboard" component={() => <Portal role="driver" />} />
    <Route path="/driver/route" component={() => <Portal role="driver" />} />
    <Route path="/driver/journey" component={() => <Portal role="driver" />} />
    <Route path="/driver/incidents" component={() => <Portal role="driver" />} />
    <Route path="/driver/rescue" component={() => <Portal role="driver" />} />
    <Route path="/driver/history" component={() => <Portal role="driver" />} />
    <Route path="/driver/notifications" component={() => <Portal role="driver" />} />
    <Route path="/driver/profile" component={() => <Portal role="driver" />} />
    <Route path="/admin/dashboard" component={() => <Portal role="admin" />} />
    <Route path="/admin/fleet" component={() => <Portal role="admin" />} />
    <Route path="/admin/routes" component={() => <Portal role="admin" />} />
    <Route path="/admin/stops" component={() => <Portal role="admin" />} />
    <Route path="/admin/drivers" component={() => <Portal role="admin" />} />
    <Route path="/admin/bookings" component={() => <Portal role="admin" />} />
    <Route path="/admin/rescue" component={() => <Portal role="admin" />} />
    <Route path="/admin/analytics" component={() => <Portal role="admin" />} />
    <Route path="/admin/reports" component={() => <Portal role="admin" />} />
    <Route path="/admin/notifications" component={() => <Portal role="admin" />} />
    <Route path="/admin/profile" component={() => <Portal role="admin" />} />
    <Route component={NotFound} />
  </Switch>;
}

export default App;
