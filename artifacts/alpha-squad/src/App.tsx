import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronDown, CircleAlert,
  ClipboardCheck, Clock3, ExternalLink, Eye, FileText, Filter, HeartHandshake,
  Layers3, LockKeyhole, LogOut, Menu, MessageSquareText, Search, ShieldCheck, Sparkles,
  UsersRound, X, Zap,
} from 'lucide-react';
import {
  ApplicationStatus, SkillLevel, getGetFounderApplicationQueryKey, getGetFounderSummaryQueryKey,
  getListFounderApplicationsQueryKey, useGetFounderApplication, useGetFounderSummary,
  useGetPublicStatus, useHealthCheck, useListFounderApplications, useRequestApplicationPrivacyAction, useSubmitApplication,
  useUpdateFounderApplication,
} from '@workspace/api-client-react';
import type { Application, ApplicationInput, ApplicationStatus as Status, ApplicationUpdate, ListFounderApplicationsParams } from '@workspace/api-client-react';
import NotFound from '@/pages/not-found';
import { ErrorBoundary } from '@/components/error-boundary';
import './alpha.css';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#54d8ff', colorForeground: '#e8edf6', colorMutedForeground: '#97a1b4',
    colorDanger: '#f05d72', colorBackground: '#151a25', colorInput: '#10151f',
    colorInputForeground: '#eef2fa', colorNeutral: '#323b4a', fontFamily: 'Manrope',
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#151a25] rounded-2xl w-[440px] max-w-full overflow-hidden border border-[#323b4a]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#f2f4f8] font-bold', headerSubtitle: 'text-[#a8b1c0]',
    socialButtonsBlockButtonText: 'text-[#e8edf6] font-semibold', formFieldLabel: 'text-[#d6dce7]',
    footerActionLink: 'text-[#54d8ff] font-semibold', footerActionText: 'text-[#a8b1c0]',
    dividerText: 'text-[#8994a7]', identityPreviewEditButton: 'text-[#54d8ff]',
    formFieldSuccessText: 'text-[#85dbbc]', alertText: 'text-[#e8edf6]',
    logoBox: 'mb-4', logoImage: 'max-h-12', socialButtonsBlockButton: 'border border-[#394354] bg-[#1c2330] hover:bg-[#222c3b]',
    formButtonPrimary: 'bg-[#54d8ff] text-[#10151f] font-bold hover:bg-[#7de3ff]',
    formFieldInput: 'border border-[#394354] bg-[#10151f] text-[#eef2fa]',
    footerAction: 'text-[#a8b1c0]', dividerLine: 'bg-[#394354]', alert: 'bg-[#291d25] border border-[#63313c]',
    otpCodeFieldInput: 'bg-[#10151f] border-[#394354]', formFieldRow: 'text-[#d6dce7]',
    main: 'text-[#e8edf6]',
  },
};

const roles = [
  { code: '01 / BUILD', title: 'The Architect', descriptor: 'Frontend & product engineering', accent: 'cyan', glyph: 'A', details: 'Shape the interface, connect the pieces, and make ideas tangible.' },
  { code: '02 / MODEL', title: 'The Alchemist', descriptor: 'AI, data & intelligent systems', accent: 'violet', glyph: '∿', details: 'Turn raw signals into useful, thoughtful product intelligence.' },
  { code: '03 / SIGNAL', title: 'The Storyteller', descriptor: 'Design, research & experience', accent: 'crimson', glyph: '◇', details: 'Find the human truth in a problem and give it a clear form.' },
  { code: '04 / ENGINE', title: 'The Catalyst', descriptor: 'Strategy, operations & momentum', accent: 'blue', glyph: '↗', details: 'Keep a multidisciplinary team moving toward the thing that matters.' },
];
const statusOptions = Object.values(ApplicationStatus) as Status[];
const skillOptions = Object.values(SkillLevel);

const freshInput = (): ApplicationInput => ({
  fullName: '', email: '', cityState: '', institution: '', background: '', academicStatus: '',
  primaryRole: '', secondarySkills: [], skillLevel: SkillLevel.Beginner, toolsUsed: [],
  projectExperience: '', contribution: '', learningGoals: '', hoursPerWeek: 5,
  motivation: '', teamwork: {
    prototypePriority: '', unfamiliarTechnology: '', blockedTeammate: '',
    failingFeature: '', architectureDisagreement: '', communicateDelays: '',
    handleFeedback: '', expectFromTeammates: '', offerToTeammates: '',
  }, favoriteAnime: '', favoriteCharacter: '', fictionalClass: '',
  phone: '', githubUrl: '', linkedinUrl: '', portfolioUrl: '', consent: true,
});

function Logo({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className="brand-lockup" aria-label="Alpha Squad home" data-testid="link-brand-home">
    <span className="brand-mark">α</span><span className="brand-word">ALPHA<span>SQUAD</span></span>
    {!compact && <span className="brand-edition">ANIME AWAKENING</span>}
  </Link>;
}

function hasSeenAwakeningIntro() {
  try {
    return window.localStorage.getItem('alpha-awakening-intro-seen') === '1';
  } catch {
    return false;
  }
}

function rememberAwakeningIntro() {
  try {
    window.localStorage.setItem('alpha-awakening-intro-seen', '1');
  } catch {
    // The intro still closes if browser storage is unavailable.
  }
}

function Header({ dense = false }: { dense?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <header className={`site-header ${dense ? 'site-header-dense' : ''}`}>
    <div className="header-inner"><Logo />
      <button type="button" className="mobile-menu-button icon-button" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} data-testid="button-toggle-navigation">{menuOpen ? <X /> : <Menu />}</button>
      <nav className={`main-nav ${menuOpen ? 'nav-open' : ''}`} aria-label="Main navigation">
        <a href={`${basePath}/#roles`} onClick={() => setMenuOpen(false)}>Find your role</a>
        <a href={`${basePath}/#protocol`} onClick={() => setMenuOpen(false)}>The protocol</a>
        <Link href="/apply" className="nav-apply" onClick={() => setMenuOpen(false)}>Enter the awakening <ArrowUpRight size={15} /></Link>
      </nav>
    </div>
  </header>;
}

function HealthIndicator() {
  const { data, isLoading, isError, refetch } = useHealthCheck();
  const online = data?.status === 'ok' || data?.status === 'healthy';
  return <div className={`health-indicator ${isError ? 'health-error' : ''}`} title={isError ? 'Could not reach the application server' : online ? 'Application server ready' : 'Checking application server'}>
    <span className={`health-dot ${isLoading ? 'is-loading' : ''}`} />
    {isError ? <button type="button" onClick={() => refetch()} data-testid="button-retry-health">Retry connection</button> : <span>{isLoading ? 'CONNECTING TO SQUAD SYSTEM' : online ? 'SQUAD SYSTEM ONLINE' : 'SYSTEM STATUS'}</span>}
  </div>;
}

function Home() {
  const { data: publicStatus, isLoading: statusLoading, isError: statusError } = useGetPublicStatus();
  const [introVisible, setIntroVisible] = useState(() => !hasSeenAwakeningIntro());
  const [introStep, setIntroStep] = useState<0 | 1>(0);
  useEffect(() => {
    if (!introVisible) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [introVisible]);
  const finishIntro = () => {
    rememberAwakeningIntro();
    setIntroVisible(false);
  };
  return <div className="grain">
    {introVisible && <AwakeningIntro step={introStep} onAdvance={() => setIntroStep(1)} onFinish={finishIntro} />}
    <Header />
    <main>
      <section className="hero-section">
        <div className="hero-grid" />
        <div className="hero-copy reveal">
          <div className="eyebrow"><span className="eyebrow-line" /> TEAM UP. MAKE THE IMPOSSIBLE RUN. <span className="eyebrow-index">01—04</span></div>
          <h1>YOUR NEXT<br /><span>ARC</span> STARTS<br />HERE<span className="hero-period">.</span></h1>
          <p className="hero-intro">A small, ambitious team. One very real hackathon. Bring what you know—and the curiosity to learn what you don't.</p>
          <div className="hero-actions">
            <Link href="/apply" className="button button-primary" data-testid="link-start-application">Begin your application <ArrowRight size={17} /></Link>
            <a href="#roles" className="text-link">Meet the roles <ArrowDown size={15} /></a>
          </div>
    <div className="hero-footnote"><span className="hero-footnote-mark">↳</span> CLASS IS A METAPHOR. YOUR SKILLS ARE YOURS.</div>
        </div>
        <div className="hero-art" style={{ backgroundImage: `url("${basePath}/awakening-team.png")` }} role="img" aria-label="Three original adult teammates at a futuristic city rooftop">
          <div className="hero-art-wash" /><div className="hero-art-label"><span>FIELD LOG / 001</span><span>THE AWAKENING</span></div>
          <div className="hero-coordinates">34°03' N &nbsp; 118°14' W</div>
          <div className="hero-side-note">BUILT TOGETHER, NEVER ALONE</div>
        </div>
        <div className="hero-bottom"><span>01 / A NEW KIND OF SQUAD</span><span>SCROLL TO DISCOVER <ArrowDown size={13} /></span></div>
      </section>

      <section className="signal-strip" aria-label="Recruitment principles">
        <div><span className="strip-icon"><UsersRound /></span><strong>SMALL BY DESIGN</strong><span>Better chemistry. Bigger swings.</span></div>
        <div><span className="strip-icon violet"><Sparkles /></span><strong>SKILL ISN'T A CHECKBOX</strong><span>Curiosity counts here.</span></div>
        <div><span className="strip-icon red"><LockKeyhole /></span><strong>PRIVATE BY DEFAULT</strong><span>Your application stays with us.</span></div>
      </section>

      <section className="roles-section section-wrap" id="roles">
        <div className="section-head">
          <div><div className="eyebrow"><span className="eyebrow-line" /> THE SQUAD ROSTER / 02</div><h2>Pick your<br /><em>starting class.</em></h2></div>
          <p>These are story-shaped ways to imagine how you might contribute. They're not gates, rankings, or prerequisites. You can build a role that fits you.</p>
        </div>
        <div className="role-list">{roles.map((role) => <Link key={role.code} href={`/apply?role=${encodeURIComponent(role.title)}`} className={`role-row role-${role.accent}`} aria-label={`Explore ${role.title} in the application`} data-testid={`link-role-${role.accent}`}>
          <span className="role-glyph">{role.glyph}</span><span className="role-code">{role.code}</span><span className="role-main"><strong>{role.title}</strong><small>{role.descriptor}</small></span><span className="role-detail">{role.details}</span><ArrowUpRight className="role-arrow" />
        </Link>)}</div>
        <p className="role-footnote"><span>NO CLASS REQUIREMENTS</span> &nbsp; Every application is read as a whole person, not a character sheet.</p>
      </section>

      <section className="manifesto-section" id="protocol">
        <div className="manifesto-aside"><span>FIELD NOTE / 03</span><span className="manifesto-mark">Ⅲ</span></div>
        <div className="manifesto-main"><p className="manifesto-kicker">THIS IS NOT A POWER RANKING.</p><h2>We don't recruit<br />finished heroes.<br /><em>We find good teammates.</em></h2>
          <div className="manifesto-bottom"><p>Honest applications. Thoughtful collaboration. Room to be new at something. That's the whole protocol.</p><Link href="/apply" className="button button-outline">Read the application <ArrowRight size={16} /></Link></div>
        </div>
      </section>

      <section className="privacy-section section-wrap">
        <div className="privacy-emblem"><ShieldCheck size={30} /><span>YOUR<br />SIGNAL</span></div>
        <div className="privacy-copy"><div className="eyebrow"><span className="eyebrow-line" /> TRANSPARENCY / 04</div><h2>Your story stays<br /><em>in the squad room.</em></h2><p>Applications are stored for recruitment review. Only authorized founders can access them. We don't use AI to score applicants.</p>
          <div className="privacy-status" aria-live="polite">
            {statusLoading ? <span className="skeleton-line" /> : statusError ? <span className="setup-error">Privacy service status unavailable. The application form remains usable.</span> : publicStatus &&
              <><StatusFact icon={<Layers3 size={16} />} label="APPLICATION STORAGE" value={publicStatus.storage === 'database' ? 'Securely stored for review' : 'Application storage is unavailable'} />
              <StatusFact icon={<MessageSquareText size={16} />} label="EMAIL UPDATES" value={publicStatus.emailNotifications ? 'Enabled' : 'Not currently configured'} />
              <StatusFact icon={<Eye size={16} />} label="AI APPLICATION SCORING" value={publicStatus.aiAnalysis ? 'Enabled' : 'Not used'} /></>}
          </div>
          <Link href="/apply" className="text-link">Apply with confidence <ArrowRight size={15} /></Link>
        </div>
      </section>

      <section className="closing-cta"><div className="closing-shape">α</div><div className="eyebrow"><span className="eyebrow-line" /> YOUR STORY, NEXT</div><h2>Make room<br />for your <em>arc.</em></h2><Link href="/apply" className="button button-primary">Start the application <ArrowRight size={17} /></Link><p>Thoughtful answers {'>'} perfect answers.</p></section>
    </main>
    <Footer onReplayIntro={() => { setIntroStep(0); setIntroVisible(true); }} />
    <div className="system-dock"><HealthIndicator /><span className="dock-divider" /><span>ALPHA SQUAD RECRUITMENT</span><span className="dock-right">PRIVATE FOUNDER REVIEW</span></div>
  </div>;
}

function AwakeningIntro({ step, onAdvance, onFinish }: { step: 0 | 1; onAdvance: () => void; onFinish: () => void }) {
  const primaryAction = useRef<HTMLButtonElement>(null);
  useEffect(() => { primaryAction.current?.focus(); }, [step]);
  return <div className={`awakening-intro ${step === 1 ? 'awakening-intro-final' : ''}`} role="dialog" aria-modal="true" aria-labelledby="awakening-title" onKeyDown={(event) => {
    if (event.key === 'Escape') { onFinish(); return; }
    if (event.key !== 'Tab') return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}>
    <div className="awakening-backdrop" style={{ backgroundImage: `url("${basePath}/awakening-team.png")` }} />
    <div className="awakening-shade" />
    <header className="awakening-topline"><Logo /><span>FIELD LOG / INTAKE 001</span><button type="button" className="intro-skip" onClick={onFinish}>Skip intro <X size={14} /></button></header>
    <div className="awakening-content" key={step}>
      <div className="eyebrow"><span className="eyebrow-line" /> SEQUENCE 0{step + 1} / 02 <span className="eyebrow-index">ALPHA SQUAD</span></div>
      {step === 0 ? <>
        <p className="awakening-kicker">A real team. A real mission.</p>
        <h1 id="awakening-title">Your next<br /><em>arc starts here.</em></h1>
        <p className="awakening-description">Bring what you know. Bring what you want to learn. The best builds begin when a squad decides to make something together.</p>
        <button ref={primaryAction} type="button" className="button button-primary awakening-cta" onClick={onAdvance}>Awaken my power <ArrowRight size={17} /></button>
      </> : <>
        <p className="awakening-kicker">One mission. Many ways to contribute.</p>
        <h1 id="awakening-title">No heroes<br /><em>go solo.</em></h1>
        <p className="awakening-description">Choose a starting role, meet the squad, and share your signal. No anime knowledge or finished portfolio required—just curiosity and care for your teammates.</p>
        <button ref={primaryAction} type="button" className="button button-primary awakening-cta" onClick={onFinish}>Enter the squad <ArrowRight size={17} /></button>
      </>}
      <span className="awakening-note"><ShieldCheck size={14} /> Your story stays yours. Skip or replay this intro any time.</span>
    </div>
    <div className="awakening-progress"><span>POWER-UP / {step === 0 ? '01' : '02'}</span><div><i style={{ width: step === 0 ? '48%' : '100%' }} /></div><span>TEAMWORK OVER RANK</span></div>
  </div>;
}

function StatusFact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="status-fact" data-testid={`status-${label.toLowerCase().replaceAll(' ', '-')}`}><span className="status-fact-icon">{icon}</span><span className="status-fact-label">{label}</span><strong>{value}</strong></div>;
}

function Footer({ onReplayIntro }: { onReplayIntro?: () => void }) {
  return <footer className="site-footer"><Logo compact /><span>AN ORIGINAL TEAM, WRITING ITS OWN ARC.</span><span className="footer-right"><Link href="/privacy-request" data-testid="link-privacy-request">Withdraw or delete data</Link>{onReplayIntro && <button type="button" onClick={onReplayIntro} data-testid="button-replay-intro">Replay intro</button>}<Link href="/founder" data-testid="link-founder-access">Founder access</Link><span>© ALPHA SQUAD</span></span></footer>;
}

const steps = ['Your signal', 'What you bring', 'How you team up', 'Review'];
const teamworkPrompts: { key: keyof ApplicationInput['teamwork']; label: string; help: string; required?: boolean }[] = [
  { key: 'prototypePriority', label: 'A prototype is due soon. How do you decide what to build first?', help: 'Tell us what you would prioritize and why.', required: true },
  { key: 'unfamiliarTechnology', label: 'You need to use a technology you have never touched. What do you do?', help: 'We value how you approach the unknown.', required: true },
  { key: 'blockedTeammate', label: 'A teammate is blocked. How might you help?', help: 'There is no single right answer.', required: true },
  { key: 'failingFeature', label: 'A feature is failing close to the deadline. What is your next move?', help: 'Share how you would navigate the tradeoffs.', required: true },
  { key: 'architectureDisagreement', label: 'You disagree with a teammate about the technical direction. How do you handle it?', help: 'Help us understand how you work through disagreement.', required: true },
];

function Field({ label, children, help, required = false }: { label: string; children: ReactNode; help?: string; required?: boolean }) {
  return <label className="field"><span className="field-label">{label}{required && <span className="required-mark"> *</span>}</span>{children}{help && <small className="field-help">{help}</small>}</label>;
}

function Input({ name, value, onChange, type = 'text', placeholder, required = false, maxLength }: { name: string; value: string | number; onChange: (value: string) => void; type?: string; placeholder?: string; required?: boolean; maxLength?: number }) {
  return <input className="form-control" name={name} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} maxLength={maxLength} data-testid={`input-${name}`} />;
}

function Textarea({ name, value, onChange, placeholder, required = false }: { name: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
  return <textarea className="form-control form-textarea" name={name} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} rows={4} data-testid={`textarea-${name}`} />;
}

function TagInput({ label, value, onChange, placeholder }: { label: string; value: string[]; onChange: (next: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('');
  function add() {
    const next = draft.trim();
    if (next && !value.includes(next)) onChange([...value, next]);
    setDraft('');
  }
  return <div className="field"><span className="field-label">{label}</span><div className="tag-input-wrap">
    {value.map((tag) => <span className="input-tag" key={tag}>{tag}<button type="button" aria-label={`Remove ${tag}`} onClick={() => onChange(value.filter((item) => item !== tag))} data-testid={`button-remove-tag-${tag.replaceAll(' ', '-')}`}><X size={13} /></button></span>)}
      <input className="tag-input" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} placeholder={placeholder} aria-label={label} data-testid={`input-tag-${label.toLowerCase().replaceAll(' ', '-')}`} />
      <button type="button" className="tag-add" onClick={add} disabled={!draft.trim()} data-testid={`button-add-${label.toLowerCase().replaceAll(' ', '-')}`}>Add</button>
    </div><small className="field-help">Press Enter or choose Add to include each item.</small></div>;
}

function ApplicationPage() {
  const [form, setForm] = useState<ApplicationInput>(() => {
    const initial = freshInput();
    const requestedRole = new URLSearchParams(window.location.search).get('role');
    if (roles.some((role) => role.title === requestedRole)) initial.primaryRole = requestedRole!;
    return initial;
  });
  const [otherRoleSelected, setOtherRoleSelected] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const mutation = useSubmitApplication();
  const update = <K extends keyof ApplicationInput>(key: K, value: ApplicationInput[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const updateTeam = (key: keyof ApplicationInput['teamwork'], value: string) => setForm((prev) => ({ ...prev, teamwork: { ...prev.teamwork, [key]: value } }));
  const requiredForStep = (n: number): string[] => {
    if (n === 0) {
      const missing = [['fullName', form.fullName, 'Your name'], ['email', form.email, 'Email'], ['cityState', form.cityState, 'City / region'], ['institution', form.institution, 'Institution'], ['background', form.background, 'Background'], ['academicStatus', form.academicStatus, 'Academic status']]
        .filter(([, value]) => !String(value).trim()).map(([, , label]) => `${label} is required.`);
      if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) missing.push('Enter a valid email address.');
      for (const [value, label] of [[form.fullName, 'Your name'], [form.cityState, 'City / region'], [form.institution, 'Institution'], [form.background, 'Background']] as const) {
        if (value.trim() && value.trim().length < 2) missing.push(`${label} needs at least 2 characters.`);
      }
      return missing;
    }
    if (n === 1) return [['primaryRole', form.primaryRole, 'Primary role'], ['learningGoals', form.learningGoals, 'Learning goals']].filter(([, value]) => !String(value).trim()).map(([, , label]) => `${label} is required.`);
    if (n === 2) return [...teamworkPrompts.filter(({ key }) => !form.teamwork[key]?.trim()).map(({ label }) => `${label} needs an answer.`), ...(!form.motivation.trim() ? ['Motivation is required.'] : [])];
    return [];
  };
  function nextStep() {
    const missing = requiredForStep(step);
    if (missing.length) { setErrors(missing); return; }
    setErrors([]); setStep(Math.min(step + 1, 3)); window.scrollTo({ top: 0 });
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const invalid = [0, 1, 2].flatMap(requiredForStep);
    if (!consentAccepted) invalid.push('Consent is required to submit.');
    if (invalid.length) { setErrors(invalid); setStep(invalid.some((item) => ['name', 'Email', 'region', 'Institution', 'Background', 'Academic'].some((s) => item.includes(s))) ? 0 : invalid.some((item) => item.includes('role') || item.includes('Learning')) ? 1 : 2); return; }
    mutation.mutate({ data: form });
  }
  if (mutation.isSuccess) return <Receipt reference={mutation.data.reference} createdAt={mutation.data.createdAt} notificationStatus={mutation.data.notificationStatus} />;
  return <div className="grain"><Header dense />
    <main className="application-shell">
      <div className="apply-topline"><Link href="/" className="back-link"><ArrowLeft size={15} /> Back to the roster</Link><span className="form-private"><LockKeyhole size={13} /> PRIVATE APPLICATION</span></div>
      <div className="form-heading"><div className="eyebrow"><span className="eyebrow-line" /> RECRUITMENT / CANDIDATE FILE</div><h1>Enter the<br /><em>awakening.</em></h1><p>This is a real team, not an audition. Take your time. Honest beats polished.</p></div>
      <div className="application-layout">
        <aside className="step-rail" aria-label="Application steps">
          {steps.map((name, index) => <button key={name} type="button" className={`step-item ${index === step ? 'step-active' : ''} ${index < step ? 'step-done' : ''}`} onClick={() => index < step && setStep(index)} disabled={index > step} aria-current={index === step ? 'step' : undefined} data-testid={`button-step-${index + 1}`}>
            <span className="step-number">{index < step ? <Check size={14} /> : `0${index + 1}`}</span><span>{name}</span>
          </button>)}
          <div className="rail-note"><ShieldCheck size={18} /><span>Only authorized founders review your application.</span></div>
        </aside>
        <form className="application-form" onSubmit={submit} noValidate>
          <div className="form-step-meta"><span>PHASE 0{step + 1} / 04</span><span>{steps[step].toUpperCase()}</span></div>
          {errors.length > 0 && <div className="validation-alert" role="alert"><CircleAlert size={17} /><div><strong>A little more signal needed</strong><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div></div>}
          {mutation.isError && <div className="validation-alert" role="alert"><CircleAlert size={17} /><div><strong>Your application did not send.</strong><span>{getErrorMessage(mutation.error)} Please try again.</span></div></div>}
          {step === 0 && <section className="form-section reveal"><h2>First, the human.</h2><p className="form-section-intro">A few basics help us understand where you are and how to reach you.</p>
            <div className="field-grid"><Field label="Full name" required><Input name="full-name" value={form.fullName} onChange={(v) => update('fullName', v)} placeholder="How should we address you?" required /></Field>
              <Field label="Email address" required><Input name="email" type="email" value={form.email} onChange={(v) => update('email', v)} placeholder="you@example.com" required /></Field>
              <Field label="City or region" required><Input name="city-state" value={form.cityState} onChange={(v) => update('cityState', v)} placeholder="City, state / region" required /></Field>
              <Field label="School, institution, or community" required><Input name="institution" value={form.institution} onChange={(v) => update('institution', v)} placeholder="Where you learn or build" required /></Field>
              <Field label="Your background" required help="Field of study, work, or the path that brought you here."><Input name="background" value={form.background} onChange={(v) => update('background', v)} placeholder="e.g. Human-computer interaction" required /></Field>
              <Field label="Academic status" required><Input name="academic-status" value={form.academicStatus} onChange={(v) => update('academicStatus', v)} placeholder="e.g. 3rd-year undergraduate" required /></Field>
              <Field label="Phone (optional)"><Input name="phone" value={form.phone ?? ''} onChange={(v) => update('phone', v)} placeholder="For coordination only" /></Field>
            </div>
          </section>}
          {step === 1 && <section className="form-section reveal"><h2>What do you bring?</h2><p className="form-section-intro">There is no perfect profile. Share the work you enjoy and what you want to explore.</p>
            <Field
              label="Your primary role"
              required
              help="Choose the closest fit—or name your own. Fictional classes are playful metaphors only."
            >
              <select
                className="form-control"
                value={otherRoleSelected ? 'Something else' : form.primaryRole}
                onChange={(event) => {
                  const value = event.target.value;
                  const isOther = value === 'Something else';
                  setOtherRoleSelected(isOther);
                  update('primaryRole', isOther ? '' : value);
                }}
                required
                data-testid="select-primary-role"
              >
                <option value="">Choose a role direction</option>
                {roles.map((role) => (
                  <option key={role.title} value={role.title}>
                    {role.title} — {role.descriptor}
                  </option>
                ))}
                <option value="Something else">Something else</option>
              </select>
            </Field>
            {otherRoleSelected && <Field label="Describe your role" required help="Use your own words. You do not need to match a preset class."><Input name="custom-role" value={form.primaryRole} onChange={(value) => update('primaryRole', value)} placeholder="e.g. accessibility, testing, community, or something new" required maxLength={100} /></Field>}
            <TagInput label="Secondary skills" value={form.secondarySkills} onChange={(v) => update('secondarySkills', v)} placeholder="e.g. user research" />
            <Field label="How would you describe your current level?" required>
              <select className="form-control" value={form.skillLevel} onChange={(e) => update('skillLevel', e.target.value as ApplicationInput['skillLevel'])} data-testid="select-skill-level">{skillOptions.map((level) => <option key={level} value={level}>{level}</option>)}</select>
            </Field>
            <TagInput label="Tools used" value={form.toolsUsed} onChange={(v) => update('toolsUsed', v)} placeholder="e.g. Figma" />
            <Field label="Projects or experiences you want us to know about" help="Links are welcome, but context matters more."><Textarea name="project-experience" value={form.projectExperience} onChange={(v) => update('projectExperience', v)} placeholder="What did you work on? What did you learn?" /></Field>
            <Field label="How would you like to contribute?"><Textarea name="contribution" value={form.contribution} onChange={(v) => update('contribution', v)} placeholder="The kinds of problems or work you would be excited to take on." /></Field>
            <Field label="What do you want to learn or get better at?" required><Textarea name="learning-goals" value={form.learningGoals} onChange={(v) => update('learningGoals', v)} placeholder="A new tool, a new perspective, a new kind of collaboration..." required /></Field>
            <Field label={`Time you can commit: ${form.hoursPerWeek} hours / week`} help="A rough estimate is fine."><input aria-label="Hours per week" className="range-control" type="range" min="1" max="40" value={form.hoursPerWeek} onChange={(e) => update('hoursPerWeek', Number(e.target.value))} data-testid="input-hours-per-week" /><span className="range-ends"><span>1 hour</span><span>40 hours</span></span></Field>
            <div className="optional-block"><span className="optional-label">JUST FOR FUN / OPTIONAL</span><div className="field-grid"><Field label="Favorite anime"><Input name="favorite-anime" value={form.favoriteAnime ?? ''} onChange={(v) => update('favoriteAnime', v)} placeholder="Anything you love" /></Field><Field label="Favorite character"><Input name="favorite-character" value={form.favoriteCharacter ?? ''} onChange={(v) => update('favoriteCharacter', v)} placeholder="Your pick" /></Field><Field label="Fictional class"><Input name="fictional-class" value={form.fictionalClass ?? ''} onChange={(v) => update('fictionalClass', v)} placeholder="A playful metaphor, if you like" /></Field></div></div>
            <div className="field-grid"><Field label="GitHub (optional)"><Input name="github-url" value={form.githubUrl ?? ''} onChange={(v) => update('githubUrl', v)} placeholder="https://github.com/…" /></Field><Field label="LinkedIn (optional)"><Input name="linkedin-url" value={form.linkedinUrl ?? ''} onChange={(v) => update('linkedinUrl', v)} placeholder="https://linkedin.com/in/…" /></Field><Field label="Portfolio (optional)"><Input name="portfolio-url" value={form.portfolioUrl ?? ''} onChange={(v) => update('portfolioUrl', v)} placeholder="https://…" /></Field></div>
          </section>}
          {step === 2 && <section className="form-section reveal"><h2>How you team up.</h2><p className="form-section-intro">We care about the work and the way we work together. There aren't hidden right answers.</p>
            <Field label="What makes you want to join this team?" required><Textarea name="motivation" value={form.motivation} onChange={(v) => update('motivation', v)} placeholder="What are you hoping to build, learn, or experience?" required /></Field>
            {teamworkPrompts.map((prompt, index) => <Field key={prompt.key} label={`${String(index + 1).padStart(2, '0')} — ${prompt.label}`} help={prompt.help} required><Textarea name={prompt.key} value={form.teamwork[prompt.key] ?? ''} onChange={(v) => updateTeam(prompt.key, v)} placeholder="A few thoughtful sentences is plenty." required /></Field>)}
            <div className="optional-block"><span className="optional-label">IF YOU'D LIKE TO SHARE MORE</span>
              <Field label="How do you communicate when plans or timing change?"><Textarea name="communicate-delays" value={form.teamwork.communicateDelays ?? ''} onChange={(v) => updateTeam('communicateDelays', v)} placeholder="Optional" /></Field>
              <Field label="How do you like to receive feedback?"><Textarea name="handle-feedback" value={form.teamwork.handleFeedback ?? ''} onChange={(v) => updateTeam('handleFeedback', v)} placeholder="Optional" /></Field>
              <Field label="What do you hope for from teammates?"><Textarea name="expect-from-teammates" value={form.teamwork.expectFromTeammates ?? ''} onChange={(v) => updateTeam('expectFromTeammates', v)} placeholder="Optional" /></Field>
              <Field label="What can teammates count on you for?"><Textarea name="offer-to-teammates" value={form.teamwork.offerToTeammates ?? ''} onChange={(v) => updateTeam('offerToTeammates', v)} placeholder="Optional" /></Field>
            </div>
          </section>}
          {step === 3 && <section className="form-section reveal"><h2>Check your signal.</h2><p className="form-section-intro">Give everything a final look. You can go back to any section before sending.</p>
            <ReviewGroup title="Your signal" step={0} onEdit={setStep}><ReviewItem label="Name" value={form.fullName} /><ReviewItem label="Email" value={form.email} /><ReviewItem label="Phone" value={form.phone} /><ReviewItem label="Location" value={form.cityState} /><ReviewItem label="Institution" value={form.institution} /><ReviewItem label="Background" value={`${form.background} · ${form.academicStatus}`} /></ReviewGroup>
            <ReviewGroup title="What you bring" step={1} onEdit={setStep}><ReviewItem label="Primary role" value={form.primaryRole} /><ReviewItem label="Experience level" value={form.skillLevel} /><ReviewItem label="Skills" value={form.secondarySkills.join(', ')} /><ReviewItem label="Tools" value={form.toolsUsed.join(', ')} /><ReviewItem label="Time" value={`${form.hoursPerWeek} hours / week`} /><ReviewItem label="Projects & experience" value={form.projectExperience} /><ReviewItem label="Contribution" value={form.contribution} /><ReviewItem label="Learning goals" value={form.learningGoals} /><ReviewItem label="GitHub" value={form.githubUrl} /><ReviewItem label="LinkedIn" value={form.linkedinUrl} /><ReviewItem label="Portfolio" value={form.portfolioUrl} /><ReviewItem label="Favorite anime" value={form.favoriteAnime} /><ReviewItem label="Favorite character" value={form.favoriteCharacter} /><ReviewItem label="Fictional class" value={form.fictionalClass} /></ReviewGroup>
            <ReviewGroup title="How you team up" step={2} onEdit={setStep}><ReviewItem label="Motivation" value={form.motivation} />{teamworkPrompts.map((prompt) => <ReviewItem key={prompt.key} label={prompt.label} value={form.teamwork[prompt.key]} />)}{form.teamwork.communicateDelays && <ReviewItem label="Communicating changes" value={form.teamwork.communicateDelays} />}{form.teamwork.handleFeedback && <ReviewItem label="Feedback" value={form.teamwork.handleFeedback} />}{form.teamwork.expectFromTeammates && <ReviewItem label="What you hope for from teammates" value={form.teamwork.expectFromTeammates} />}{form.teamwork.offerToTeammates && <ReviewItem label="What teammates can count on you for" value={form.teamwork.offerToTeammates} />}</ReviewGroup>
            <label className="consent-check"><input type="checkbox" checked={consentAccepted} onChange={(e) => setConsentAccepted(e.target.checked)} data-testid="input-application-consent" /><span><strong>I understand how this application is used.</strong><small>It will be stored for recruitment review and visible only to authorized founders. Fictional classes do not affect eligibility. I can use the site footer to withdraw or request deletion.</small></span></label>
          </section>}
          <div className="form-navigation">
            {step > 0 ? <button className="button button-quiet" type="button" onClick={() => { setErrors([]); setStep(step - 1); }} data-testid="button-previous-step"><ArrowLeft size={16} /> Previous</button> : <span className="form-save-note"><LockKeyhole size={14} /> Nothing is sent until you choose to submit.</span>}
            {step < 3 ? <button className="button button-primary" type="button" onClick={nextStep} data-testid="button-next-step">Continue <ArrowRight size={16} /></button> : <button className="button button-primary" type="submit" disabled={mutation.isPending} data-testid="button-submit-application">{mutation.isPending ? 'Sending your application…' : 'Send my application'} {mutation.isPending ? <span className="button-pulse" /> : <ArrowRight size={16} />}</button>}
          </div>
        </form>
      </div>
    </main><Footer />
  </div>;
}

function ReviewGroup({ title, step, onEdit, children }: { title: string; step: number; onEdit: (step: number) => void; children: ReactNode }) {
  return <div className="review-group"><div className="review-group-head"><h3>{title}</h3><button type="button" onClick={() => onEdit(step)} data-testid={`button-edit-review-${step}`}>Edit <ArrowUpRight size={13} /></button></div><div className="review-items">{children}</div></div>;
}
function ReviewItem({ label, value }: { label: string; value?: string }) {
  return <div className="review-item"><span>{label}</span><strong>{value?.trim() || 'Not provided'}</strong></div>;
}

function Receipt({ reference, createdAt, notificationStatus }: { reference: string; createdAt: string; notificationStatus: string }) {
  const date = new Date(createdAt);
  return <div className="grain"><Header dense /><main className="receipt-page"><div className="receipt-card reveal"><div className="receipt-check"><Check size={30} /></div><div className="eyebrow"><span className="eyebrow-line" /> APPLICATION RECEIVED</div><h1>Signal<br /><em>received.</em></h1><p>Your application is in the squad room. Thanks for sharing your story with us.</p><div className="receipt-reference"><span>REFERENCE ID</span><strong>{reference}</strong></div><div className="receipt-meta"><span>SUBMITTED</span><strong>{Number.isNaN(date.valueOf()) ? 'Just now' : date.toLocaleString()}</strong></div>{notificationStatus !== 'configured' && <p className="receipt-notice">Email confirmation is not currently available. Keep your reference ID for your records.</p>}<p className="receipt-privacy-note">Need to withdraw or remove your application? Use the private <Link href="/privacy-request">data request form</Link> with this reference and your application email.</p><Link href="/" className="button button-outline">Return to the roster <ArrowRight size={16} /></Link></div></main><Footer /></div>;
}

function PrivacyRequestPage() {
  const [reference, setReference] = useState('');
  const [email, setEmail] = useState('');
  const [action, setAction] = useState<'WITHDRAW' | 'DELETE'>('WITHDRAW');
  const mutation = useRequestApplicationPrivacyAction();
  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate({ data: { reference: reference.trim().toUpperCase(), email: email.trim().toLowerCase(), action } });
  }
  return <div className="grain"><Header dense />
    <main className="application-shell privacy-request-shell">
      <div className="apply-topline"><Link href="/" className="back-link"><ArrowLeft size={15} /> Back to the roster</Link><span className="form-private"><LockKeyhole size={13} /> PRIVATE DATA REQUEST</span></div>
      <div className="form-heading"><div className="eyebrow"><span className="eyebrow-line" /> CANDIDATE CONTROL / PRIVACY</div><h1>Your data.<br /><em>Your call.</em></h1><p>Withdraw an application or permanently delete the matching candidate record.</p></div>
      <section className="privacy-request-card">
        {mutation.isSuccess ? <div className="privacy-request-success" role="status"><div className="receipt-check"><Check size={26} /></div><div className="eyebrow"><span className="eyebrow-line" /> REQUEST COMPLETE</div><h2>Signal updated.</h2><p>{mutation.data.message}</p><Link href="/" className="button button-outline">Return to the roster <ArrowRight size={16} /></Link></div> : <form onSubmit={submit} noValidate>
          <div className="privacy-request-intro"><ShieldCheck size={20} /><p>Enter the reference shown after submission and the same email address used to apply. We never reveal whether an application matched.</p></div>
          <Field label="Application reference" required help="Example: ALPHA-2026-… Find it on your submission receipt."><Input name="privacy-reference" value={reference} onChange={setReference} placeholder="ALPHA-2026-…" required /></Field>
          <Field label="Application email" required><Input name="privacy-email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" required /></Field>
          <fieldset className="privacy-action-options"><legend>Choose an action</legend>
            <label className={action === 'WITHDRAW' ? 'privacy-action-selected' : ''}><input type="radio" name="privacy-action" value="WITHDRAW" checked={action === 'WITHDRAW'} onChange={() => setAction('WITHDRAW')} /><span><strong>Withdraw</strong><small>Mark the application withdrawn. The record remains available to founders for recruitment history.</small></span></label>
            <label className={action === 'DELETE' ? 'privacy-action-selected' : ''}><input type="radio" name="privacy-action" value="DELETE" checked={action === 'DELETE'} onChange={() => setAction('DELETE')} /><span><strong>Permanently delete</strong><small>Remove the matching application and founder notes from the database. This cannot be undone.</small></span></label>
          </fieldset>
          {mutation.isError && <div className="validation-alert" role="alert"><CircleAlert size={17} /><div><strong>The request could not be processed.</strong><span>{getErrorMessage(mutation.error)} Please try again.</span></div></div>}
          <button type="submit" className="button button-primary privacy-request-submit" disabled={mutation.isPending || !reference.trim() || !email.trim()}>{mutation.isPending ? 'Processing request…' : action === 'DELETE' ? 'Delete my application' : 'Withdraw my application'} <ArrowRight size={16} /></button>
        </form>}
      </section>
    </main><Footer />
  </div>;
}

function FounderGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <ShellState title="Checking your session" detail="Opening the private squad room…" loading />;
  if (!isSignedIn) return <div className="grain"><Header dense /><main className="gate-page"><div className="gate-card"><div className="gate-icon"><LockKeyhole /></div><div className="eyebrow"><span className="eyebrow-line" /> PRIVATE / FOUNDER ACCESS</div><h1>Squad room<br /><em>restricted.</em></h1><p>The recruitment dashboard is private to authorized founders. Sign in with your founder account to continue.</p><Link href="/sign-in" className="button button-primary">Founder sign in <ArrowRight size={16} /></Link><Link href="/" className="text-link">Return to public roster</Link></div></main><Footer /></div>;
  return <>{children}</>;
}

function FounderShell({ children, active = 'pipeline' }: { children: ReactNode; active?: string }) {
  const { signOut } = useClerk();
  const { user } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  return <div className="founder-layout grain">
    <aside className={`founder-sidebar ${menuOpen ? 'founder-sidebar-open' : ''}`}>
      <div className="founder-brand"><Logo /><span className="founder-private-label"><LockKeyhole size={12} /> PRIVATE SPACE</span></div>
      <div className="founder-nav-caption">RECRUITMENT</div>
      <nav className="founder-nav"><Link href="/founder" className={active === 'pipeline' ? 'founder-nav-active' : ''} data-testid="link-founder-pipeline"><Layers3 size={17} />Pipeline<span className="nav-active-marker" /></Link></nav>
      <div className="sidebar-lower"><div className="founder-user"><span className="user-avatar">{user?.firstName?.slice(0, 1) || 'F'}</span><div><strong>{user?.fullName || 'Founder'}</strong><small>Authorized founder</small></div></div><button type="button" className="sign-out-button" onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="button-founder-sign-out"><LogOut size={16} /> Sign out</button></div>
    </aside>
    <div className="founder-main">
      <header className="founder-topbar"><button type="button" className="mobile-menu-button icon-button" aria-label="Toggle founder navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} data-testid="button-toggle-founder-navigation">{menuOpen ? <X /> : <Menu />}</button><div className="breadcrumb"><span>ALPHA SQUAD</span><span>/</span><strong>{active === 'detail' ? 'CANDIDATE FILE' : 'RECRUITMENT PIPELINE'}</strong></div><Link href="/" className="exit-dashboard">Public site <ExternalLink size={14} /></Link></header>
      <main className="founder-content">{children}</main>
    </div>
  </div>;
}

function FounderDashboard() {
  return <FounderGate><FounderDashboardContent /></FounderGate>;
}

function FounderDashboardContent() {
  const { data: summary, isLoading: summaryLoading, isError: summaryError, refetch: retrySummary } = useGetFounderSummary();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<Status | 'ALL'>('ALL');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const params = useMemo<ListFounderApplicationsParams>(() => ({
    ...(status === 'ALL' ? {} : { status }),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  }), [status, debouncedSearch]);
  const { data: list, isLoading, isError, error, refetch } = useListFounderApplications(params);
  const { signOut } = useClerk();
  const { user } = useUser();
  const errorText = getErrorMessage(error);
  const privateUnavailable = isError && /not configured|configuration|unavailable/i.test(errorText);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [search]);
  return <FounderShell><div className="dashboard-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> FOUNDER CONSOLE / 01</div><h1>The recruitment<br /><em>pipeline.</em></h1><p>Thoughtful review starts with a clear view of the squad.</p></div><button className="button button-outline dashboard-refresh" type="button" onClick={() => { void retrySummary(); void refetch(); }} data-testid="button-refresh-pipeline"><span className="refresh-glyph">↻</span> Refresh</button></div>
    {summaryError && <div className="founder-alert" role="alert"><CircleAlert size={18} /><div><strong>Pipeline totals are unavailable.</strong><span>The server could not return recruitment summary data.</span><button type="button" onClick={() => retrySummary()} data-testid="button-retry-summary">Retry totals</button></div></div>}
    <section className="metrics-grid" aria-label="Recruitment pipeline summary">
      {[
        ['TOTAL APPLICATIONS', summary?.total, <UsersRound size={17} />],
        ['NEW', summary?.new, <Sparkles size={17} />],
        ['UNDER REVIEW', summary?.underReview, <Eye size={17} />],
        ['INTERVIEWS', summary?.interviews, <MessageSquareText size={17} />],
        ['PRACTICAL TASKS', summary?.practicalTasks, <ClipboardCheck size={17} />],
        ['SHORTLISTED', summary?.shortlisted, <HeartHandshake size={17} />],
        ['SELECTED', summary?.selected, <Zap size={17} />],
      ].map(([label, value, icon], index) => <div key={String(label)} className={`metric-tile ${index === 0 ? 'metric-featured' : ''}`} data-testid={`metric-${String(label).toLowerCase().replaceAll(' ', '-')}`}><div className="metric-top"><span>{label}</span>{icon}</div><strong>{summaryLoading ? <i className="skeleton-number" /> : value ?? '—'}</strong></div>)}
    </section>
    <section className="applications-panel">
      <div className="panel-heading"><div><span className="eyebrow-label">CANDIDATE FILES</span><h2>Applications <span>{list?.total ?? ''}</span></h2></div><span className="panel-live"><span /> LIVE DATA</span></div>
      <div className="list-controls"><label className="search-control"><Search size={16} /><input type="search" placeholder="Search name, email, or reference" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search applications" data-testid="input-search-applications" /><kbd>⌕</kbd></label>
        <label className="filter-control"><Filter size={15} /><select value={status} onChange={(e) => setStatus(e.target.value as Status | 'ALL')} aria-label="Filter by status" data-testid="select-application-status"><option value="ALL">All statuses</option>{statusOptions.map((value) => <option value={value} key={value}>{value}</option>)}</select><ChevronDown size={14} /></label>
      </div>
      {isLoading ? <div className="applications-loading" aria-label="Loading applications"><div className="skeleton-row" /><div className="skeleton-row" /><div className="skeleton-row" /></div>
        : isError ? <div className="empty-state error-state"><CircleAlert size={26} /><h3>{privateUnavailable ? 'Founder access is not configured.' : 'The candidate files could not load.'}</h3><p>{privateUnavailable ? 'The server has not configured founder access. No candidate details are available.' : 'The server did not return the application list. Try again shortly.'}</p>{privateUnavailable && user?.id && <div className="founder-setup-note"><span>To authorize this account, add this ID to the server-side FOUNDER_USER_IDS environment variable:</span><code>{user.id}</code></div>}{!privateUnavailable && <button type="button" className="button button-outline" onClick={() => refetch()} data-testid="button-retry-applications">Retry applications <ArrowRight size={15} /></button>}{/unauthorized|forbidden/i.test(errorText) && <button type="button" className="text-link-button" onClick={() => signOut({ redirectUrl: `${basePath}/sign-in` })} data-testid="button-refresh-founder-session">Refresh founder session</button>}</div>
        : list?.applications.length ? <div className="application-table-wrap"><table className="application-table"><thead><tr><th>Candidate</th><th>Primary role</th><th>Experience</th><th>Received</th><th>Status</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{list.applications.map((app) => <ApplicationRow key={app.id} app={app} />)}</tbody></table></div>
        : <div className="empty-state"><div className="empty-orbit"><Search size={24} /></div><h3>{debouncedSearch || status !== 'ALL' ? 'No matching applications.' : 'The roster is open.'}</h3><p>{debouncedSearch || status !== 'ALL' ? 'Try another search or clear the status filter.' : 'There are no candidate applications to review yet.'}</p>{(debouncedSearch || status !== 'ALL') && <button type="button" className="button button-quiet" onClick={() => { setSearch(''); setStatus('ALL'); }} data-testid="button-clear-application-filters">Clear filters <X size={15} /></button>}</div>}
    </section>
    <footer className="founder-footer">Candidate information is private. Review only what you need.<span>ALPHA SQUAD / INTERNAL</span></footer>
  </FounderShell>;
}

function ApplicationRow({ app }: { app: Application }) {
  const created = new Date(app.createdAt);
  return <tr data-testid={`row-application-${app.id}`}><td><Link href={`/founder/${app.id}`} className="candidate-name-link"><span className="candidate-initial">{app.fullName.charAt(0).toUpperCase()}</span><span><strong>{app.fullName}</strong><small>{app.reference}</small></span></Link></td><td>{app.primaryRole || '—'}</td><td><span className="level-label">{app.skillLevel}</span></td><td className="date-cell">{Number.isNaN(created.valueOf()) ? '—' : created.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td><td><StatusPill status={app.status} /></td><td><Link className="row-open" href={`/founder/${app.id}`} aria-label={`Review ${app.fullName}'s application`} data-testid={`link-review-application-${app.id}`}><ArrowUpRight size={16} /></Link></td></tr>;
}

function StatusPill({ status }: { status: Status }) {
  return <span className={`status-pill status-${status.toLowerCase().replaceAll(' ', '-')}`}>{status}</span>;
}

function CandidateDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? '';
  return <CandidateDetailContent id={id} />;
}

function CandidateDetailContent({ id }: { id: string }) {
  const { data: app, isLoading, isError, error, refetch } = useGetFounderApplication(id);
  const queryClient = useQueryClient();
  const mutation = useUpdateFounderApplication();
  const [status, setStatus] = useState<Status | ''>('');
  const [notes, setNotes] = useState('');
  const initializedId = useRef('');
  useEffect(() => {
    if (app && initializedId.current !== app.id) {
      initializedId.current = app.id; setStatus(app.status); setNotes(app.founderNotes ?? '');
    }
  }, [app]);
  const save = (data: ApplicationUpdate) => mutation.mutate({ id, data }, {
    onSuccess: (updated) => {
      queryClient.setQueryData(getGetFounderApplicationQueryKey(id), updated);
      void queryClient.invalidateQueries({ queryKey: getListFounderApplicationsQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetFounderSummaryQueryKey() });
      setStatus(updated.status); setNotes(updated.founderNotes ?? '');
    },
  });
  return <FounderGate><FounderShell active="detail">
    <Link href="/founder" className="detail-back"><ArrowLeft size={15} /> Back to pipeline</Link>
    {isLoading ? <div className="detail-loading"><div className="skeleton-line" /><div className="skeleton-title" /><div className="skeleton-row" /><div className="skeleton-row" /></div>
      : isError || !app ? <div className="empty-state detail-error"><CircleAlert size={27} /><h3>{/not configured|configuration|unavailable/i.test(getErrorMessage(error)) ? 'Founder access is not configured.' : 'This candidate file is unavailable.'}</h3><p>{/not configured|configuration|unavailable/i.test(getErrorMessage(error)) ? 'The server has not configured founder access. No candidate details are available.' : 'Candidate details could not be loaded. If access is not configured on the server, no private data is shown.'}</p><button className="button button-outline" type="button" onClick={() => refetch()} data-testid="button-retry-candidate">Retry candidate file <ArrowRight size={15} /></button></div>
      : <><div className="candidate-detail-head"><div><div className="eyebrow"><span className="eyebrow-line" /> CANDIDATE FILE / {app.reference}</div><h1>{app.fullName}</h1><p>{app.primaryRole} <span>·</span> {app.cityState} <span>·</span> Received {new Date(app.createdAt).toLocaleDateString()}</p></div><StatusPill status={app.status} /></div>
        {mutation.isError && <div className="founder-alert" role="alert"><CircleAlert size={18} /><div><strong>Changes could not be saved.</strong><span>{getErrorMessage(mutation.error)}</span></div></div>}
        {mutation.isSuccess && <div className="save-success" role="status"><Check size={15} /> Changes saved to the candidate file.</div>}
        <div className="candidate-detail-grid"><div className="candidate-main-column">
          <DetailSection title="Candidate profile" icon={<UsersRound size={17} />}><div className="detail-info-grid"><DetailValue label="Email" value={app.email} link={`mailto:${app.email}`} /><DetailValue label="Phone" value={app.phone} link={app.phone ? `tel:${app.phone}` : undefined} /><DetailValue label="Institution" value={app.institution} /><DetailValue label="Academic status" value={app.academicStatus} /><DetailValue label="Background" value={app.background} /><DetailValue label="Experience level" value={app.skillLevel} /><DetailValue label="Time available" value={`${app.hoursPerWeek} hours / week`} /></div><DetailValue label="Secondary skills" value={app.secondarySkills.join(', ')} /><DetailValue label="Tools" value={app.toolsUsed.join(', ')} /></DetailSection>
          <DetailSection title="Their story" icon={<FileText size={17} />}><DetailValue label="Motivation" value={app.motivation} /><DetailValue label="Projects & experience" value={app.projectExperience} /><DetailValue label="Contribution" value={app.contribution} /><DetailValue label="Learning goals" value={app.learningGoals} /></DetailSection>
          <DetailSection title="Collaboration" icon={<HeartHandshake size={17} />}>{teamworkPrompts.map(({ key, label }) => <DetailValue key={key} label={label} value={app.teamwork[key]} />)}{app.teamwork.communicateDelays && <DetailValue label="Communicating changes" value={app.teamwork.communicateDelays} />}{app.teamwork.handleFeedback && <DetailValue label="Feedback" value={app.teamwork.handleFeedback} />}{app.teamwork.expectFromTeammates && <DetailValue label="What they hope for from teammates" value={app.teamwork.expectFromTeammates} />}{app.teamwork.offerToTeammates && <DetailValue label="What teammates can count on" value={app.teamwork.offerToTeammates} />}</DetailSection>
          {(app.favoriteAnime || app.favoriteCharacter || app.fictionalClass) && <DetailSection title="Optional / just for fun" icon={<Sparkles size={17} />}><DetailValue label="Favorite anime" value={app.favoriteAnime} /><DetailValue label="Favorite character" value={app.favoriteCharacter} /><DetailValue label="Fictional class" value={app.fictionalClass} /><p className="class-disclaimer">Playful metaphor only. It does not affect eligibility.</p></DetailSection>}
          <DetailSection title="Links" icon={<ExternalLink size={17} />}><DetailValue label="GitHub" value={app.githubUrl} link={app.githubUrl} /><DetailValue label="LinkedIn" value={app.linkedinUrl} link={app.linkedinUrl} /><DetailValue label="Portfolio" value={app.portfolioUrl} link={app.portfolioUrl} /></DetailSection>
        </div>
        <aside className="candidate-review-panel"><div className="review-panel-title"><span className="review-icon"><ClipboardCheck size={18} /></span><div><strong>Review controls</strong><small>Founder-only notes and status</small></div></div>
          <label className="field"><span className="field-label">Application status</span><select className="form-control" value={status} onChange={(e) => setStatus(e.target.value as Status)} data-testid="select-candidate-status">{statusOptions.map((option) => <option value={option} key={option}>{option}</option>)}</select></label>
          <label className="field"><span className="field-label">Private founder notes</span><textarea className="form-control form-textarea founder-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={5000} rows={7} placeholder="Private notes for the founding team…" data-testid="textarea-founder-notes" /><small className="field-help">Visible only to authorized founders. {notes.length}/5000</small></label>
          <button type="button" className="button button-primary review-save" disabled={mutation.isPending || (status === app.status && notes === app.founderNotes)} onClick={() => save({ status: status === app.status ? undefined : status as Status, founderNotes: notes === app.founderNotes ? undefined : notes })} data-testid="button-save-review">{mutation.isPending ? 'Saving…' : 'Save review changes'} <ArrowRight size={16} /></button>
          <div className="review-meta"><span><Clock3 size={14} /> Last updated</span><strong>{new Date(app.updatedAt).toLocaleString()}</strong></div>
        </aside></div>
      </>}
  </FounderShell></FounderGate>;
}

function DetailSection({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <section className="detail-section"><div className="detail-section-title"><span>{icon}</span><h2>{title}</h2></div><div className="detail-section-body">{children}</div></section>;
}
function DetailValue({ label, value, link }: { label: string; value?: string; link?: string }) {
  if (!value) return null;
  const safeLink = link && (/^(mailto|tel):/.test(link) || /^https?:\/\//i.test(link)) ? link : undefined;
  return <div className="detail-value"><span>{label}</span>{safeLink ? <a href={safeLink} target={safeLink.startsWith('http') ? '_blank' : undefined} rel={safeLink.startsWith('http') ? 'noreferrer' : undefined}>{value} {safeLink.startsWith('http') && <ExternalLink size={12} />}</a> : <strong>{value}</strong>}</div>;
}

function ShellState({ title, detail, loading = false }: { title: string; detail: string; loading?: boolean }) {
  return <div className="grain"><Header dense /><main className="gate-page"><div className="gate-card"><div className="empty-orbit">{loading ? <span className="button-pulse" /> : <CircleAlert />}</div><h1>{title}</h1><p>{detail}</p></div></main></div>;
}

function SignInPage() {
  return <main className="auth-page grain"><div className="auth-brand"><Logo /><span className="eyebrow">FOUNDER ACCESS / AUTHENTICATED</span></div><div className="auth-art-note"><span>ALPHA SQUAD</span><strong>THE WORK<br />IS OURS TO<br /><em>MAKE.</em></strong><small>PRIVATE RECRUITMENT CONSOLE</small></div><div className="auth-component"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div></main>;
}
function SignUpPage() {
  return <main className="auth-page grain"><div className="auth-brand"><Logo /><span className="eyebrow">FOUNDER ACCESS / AUTHENTICATED</span></div><div className="auth-art-note"><span>ALPHA SQUAD</span><strong>THE WORK<br />IS OURS TO<br /><em>MAKE.</em></strong><small>PRIVATE RECRUITMENT CONSOLE</small></div><div className="auth-component"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div></main>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) client.clear();
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, client]);
  return null;
}

function RouterContent() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
    localization={{ signIn: { start: { title: 'Founder sign in', subtitle: 'Enter the private Alpha Squad recruitment room.' } }, signUp: { start: { title: 'Founder account', subtitle: 'Create an authorized founder account.' } } }}
    routerPush={(to) => setLocation(stripBase(to))} routerReplace={(to) => setLocation(stripBase(to), { replace: true })}>
    <QueryClientProvider client={queryClient}><ClerkQueryClientCacheInvalidator />
      <RoutedErrorBoundary><Switch>
        <Route path="/" component={Home} />
        <Route path="/apply" component={ApplicationPage} />
        <Route path="/privacy-request" component={PrivacyRequestPage} />
        <Route path="/founder/:id" component={CandidateDetail} />
        <Route path="/founder" component={FounderDashboard} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route component={NotFound} />
      </Switch></RoutedErrorBoundary>
    </QueryClientProvider>
  </ClerkProvider>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  if (!clerkPubKey) return <ShellState title="Authentication is not configured." detail="Add the Clerk publishable key to enable the founder sign-in routes. Public recruitment and applications remain available after configuration." />;
  return <WouterRouter base={basePath}><RouterContent /></WouterRouter>;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'The server returned an unexpected error.';
}

export default App;
