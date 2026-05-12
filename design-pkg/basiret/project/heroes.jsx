// Hero variations for Basiret
// Note: original product uses branded purple + floating channel icons.
// We keep the purple accent + channel motif but rework balance & trust.

const BRAND = {
  purple: '#5B3BE8',       // slightly deeper than original for trust
  purpleSoft: '#EEEAFE',
  ink: '#151324',
  ink2: '#3A3650',
  muted: '#6B6880',
  line: '#E7E4F0',
  bg: '#FBFAF7',
  bgAlt: '#F5F2EC',
  green: '#1F9D6B',
  amber: '#C88A2A',
};

// Channel glyphs — tiny inline SVGs, neutral monochrome variants so they read
// as a system rather than sticker chaos. Each returns a 20x20 node.
const Ch = {
  x:  (c='currentColor') => <svg viewBox="0 0 24 24" width="100%" height="100%"><path fill={c} d="M18.9 3H22l-7.5 8.6L23 21h-6.8l-5.3-6.9L4.7 21H1.6l8-9.2L1 3h7l4.8 6.3L18.9 3Zm-1.2 16h1.9L7.4 5H5.4l12.3 14Z"/></svg>,
  ig: (c='currentColor') => <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke={c} strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill={c} stroke="none"/></svg>,
  yt: (c='currentColor') => <svg viewBox="0 0 24 24" width="100%" height="100%"><path fill={c} d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2C.5 9 .5 12 .5 12s0 3 .5 4.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1c.5-1.8.5-4.8.5-4.8s0-3-.5-4.8ZM9.8 15.4V8.6l5.9 3.4-5.9 3.4Z"/></svg>,
  tt: (c='currentColor') => <svg viewBox="0 0 24 24" width="100%" height="100%"><path fill={c} d="M20 8.3a7.2 7.2 0 0 1-4.2-1.4v7.7a5.8 5.8 0 1 1-5-5.7v2.6a3.2 3.2 0 1 0 2.3 3.1V2h2.6a4.7 4.7 0 0 0 4.3 4.3v2Z"/></svg>,
  li: (c='currentColor') => <svg viewBox="0 0 24 24" width="100%" height="100%"><path fill={c} d="M4.5 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM3 9h3v12H3V9Zm6 0h2.9v1.7h.1c.4-.8 1.5-1.7 3.1-1.7 3.3 0 4 2.2 4 5V21h-3v-5.5c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9V21H9V9Z"/></svg>,
  fb: (c='currentColor') => <svg viewBox="0 0 24 24" width="100%" height="100%"><path fill={c} d="M13.5 21v-8h2.7l.4-3.2h-3.1V7.8c0-.9.3-1.6 1.7-1.6h1.6V3.4c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.1v2.4H7.7V13h2.7v8h3.1Z"/></svg>,
  th: (c='currentColor') => <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke={c} strokeWidth="1.8"><path d="M12 21c5 0 8-3.5 8-8.5S17 4 12.2 4C7.5 4 5 6.6 5 10.2c0 2 1.6 3.4 3.7 3.4 2 0 3.3-1.3 3.3-3 0-1.5-1.1-2.6-2.6-2.6"/></svg>,
  bs: (c='currentColor') => <svg viewBox="0 0 24 24" width="100%" height="100%"><path fill={c} d="M6 4c2.8 2 5.8 6 7 8 1.2-2 4.2-6 7-8 2.2-1.6 4 .2 4 2.5 0 .5 0 1.9-.4 3.4-.4 2-1.2 3-2.2 3.3.6.2 1.7.8 2.4 2.2.7 1.5.5 4-1.4 4.9-1.8.9-4.8.3-8.4-3.7-3.6 4-6.6 4.6-8.4 3.7-2-.9-2-3.4-1.4-4.9.7-1.4 1.8-2 2.4-2.2-1 -.3-1.8-1.3-2.2-3.3A17 17 0 0 1 2 6.5C2 4.2 3.8 2.4 6 4Z"/></svg>,
};

const channels = [
  { k: 'x',  name: 'X',         c: '#151324' },
  { k: 'ig', name: 'Instagram', c: '#C93B7B' },
  { k: 'yt', name: 'YouTube',   c: '#D72828' },
  { k: 'tt', name: 'TikTok',    c: '#151324' },
  { k: 'li', name: 'LinkedIn',  c: '#0A66C2' },
  { k: 'fb', name: 'Facebook',  c: '#1877F2' },
  { k: 'th', name: 'Threads',   c: '#151324' },
  { k: 'bs', name: 'Bluesky',   c: '#0085FF' },
];

// ───────── Shared top nav for all variants ─────────
function Nav({ width, variant = 'light' }) {
  const dark = variant === 'dark';
  const fg = dark ? '#F5F2EC' : BRAND.ink;
  const mut = dark ? 'rgba(245,242,236,.7)' : BRAND.muted;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '18px 40px', borderBottom: `1px solid ${dark ? 'rgba(255,255,255,.08)' : BRAND.line}`,
      width, boxSizing: 'border-box', fontSize: 14, color: fg,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontWeight: 700, letterSpacing: -0.2 }}>
          <span style={{ fontSize: 17 }}>Basiret</span>
          <span style={{ color: mut, fontSize: 14 }}>|</span>
          <span style={{ fontSize: 16, fontWeight: 600 }}>بصيرة</span>
        </div>
        <div style={{ display: 'flex', gap: 26, color: mut, fontSize: 14 }}>
          {['Features','Channels','Made for','Resources','Pricing'].map(x => (
            <span key={x} style={{ display:'flex', alignItems:'center', gap:4, cursor:'pointer' }}>
              {x}{x !== 'Pricing' && <svg width="9" height="9" viewBox="0 0 10 10"><path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.4"/></svg>}
            </span>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, color: mut }}>
        <span style={{ display:'flex', alignItems:'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="8" cy="8" r="6.5"/><path d="M1.5 8h13M8 1.5c2 2 2 11 0 13M8 1.5c-2 2-2 11 0 13"/></svg>
          عربي
        </span>
        <span style={{ cursor: 'pointer' }}>Log in</span>
        <button style={{
          background: BRAND.purple, color: '#fff', border: 'none',
          padding: '9px 16px', borderRadius: 8, fontWeight: 600, fontSize: 13.5, cursor: 'pointer',
        }}>Start free</button>
      </div>
    </div>
  );
}

// Reusable pieces
const Eyebrow = ({ children, tone='purple' }) => (
  <div style={{
    display:'inline-flex', alignItems:'center', gap:8,
    padding:'6px 11px 6px 8px', borderRadius: 99,
    background: tone==='purple'? BRAND.purpleSoft : 'rgba(255,255,255,.08)',
    color: tone==='purple'? BRAND.purple : '#F5F2EC',
    fontSize: 12.5, fontWeight: 600, letterSpacing: 0.1,
    border: tone==='purple'? 'none' : '1px solid rgba(255,255,255,.14)',
  }}>
    <span style={{
      width:16, height:16, borderRadius: 99,
      background: tone==='purple'? BRAND.purple : '#F5F2EC',
      color: tone==='purple'? '#fff' : BRAND.ink,
      display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700,
    }}>★</span>
    {children}
  </div>
);

const Stars = ({ color='#C88A2A' }) => (
  <div style={{ display:'flex', gap:2 }}>
    {[0,1,2,3,4].map(i => (
      <svg key={i} width="13" height="13" viewBox="0 0 24 24"><path fill={color} d="M12 2l2.9 6.9 7.1.5-5.4 4.7 1.7 7-6.3-4-6.3 4 1.7-7L2 9.4l7.1-.5L12 2Z"/></svg>
    ))}
  </div>
);

const PrimaryBtn = ({ children, dark=false }) => (
  <button style={{
    background: dark ? '#F5F2EC' : BRAND.purple,
    color: dark ? BRAND.ink : '#fff',
    border: 'none', padding: '13px 20px', borderRadius: 10,
    fontWeight: 600, fontSize: 14.5, cursor:'pointer',
    display:'inline-flex', alignItems:'center', gap:8, letterSpacing:-0.1,
  }}>{children}
    <svg width="14" height="14" viewBox="0 0 16 16"><path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
  </button>
);

const GhostBtn = ({ children, dark=false }) => (
  <button style={{
    background: 'transparent',
    color: dark ? '#F5F2EC' : BRAND.ink,
    border: `1px solid ${dark ? 'rgba(255,255,255,.18)' : BRAND.line}`,
    padding: '12px 18px', borderRadius: 10,
    fontWeight: 500, fontSize: 14.5, cursor:'pointer',
    display:'inline-flex', alignItems:'center', gap:8,
  }}>
    <svg width="12" height="12" viewBox="0 0 14 14"><polygon points="3,2 12,7 3,12" fill="currentColor"/></svg>
    {children}
  </button>
);

// Small reused avatar stack for social proof
const Avatars = () => {
  const colors = ['#C93B7B', '#5B3BE8', '#1F9D6B', '#C88A2A', '#0A66C2'];
  const initials = ['LR', 'MA', 'SK', 'NP', 'JH'];
  return (
    <div style={{ display:'flex' }}>
      {colors.map((c, i) => (
        <div key={i} style={{
          width: 28, height: 28, borderRadius: 99, background: c, color: '#fff',
          border: '2px solid #fff', marginLeft: i===0?0:-8, display:'flex',
          alignItems:'center', justifyContent:'center', fontSize: 10.5, fontWeight: 700,
        }}>{initials[i]}</div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// V1 — Calm centered, tightened. Icons become a trust band.
// ═══════════════════════════════════════════════════════════════
function HeroV1({ width = 1280, height = 820 }) {
  return (
    <div style={{ width, height, background: BRAND.bg, fontFamily: 'Inter, -apple-system, sans-serif', color: BRAND.ink, position:'relative', overflow:'hidden' }}>
      {/* faint grid */}
      <div style={{
        position:'absolute', inset:0, opacity:.5,
        backgroundImage:`linear-gradient(${BRAND.line} 1px, transparent 1px), linear-gradient(90deg, ${BRAND.line} 1px, transparent 1px)`,
        backgroundSize:'60px 60px', maskImage:'radial-gradient(ellipse at center, black 40%, transparent 80%)', WebkitMaskImage:'radial-gradient(ellipse at center, black 40%, transparent 80%)',
      }}/>
      <Nav width={width} />
      <div style={{ position:'relative', padding: '80px 40px 0', display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center' }}>
        <Eyebrow>New · Scheduler v3 is live</Eyebrow>

        <h1 style={{
          fontSize: 76, lineHeight: 1.02, letterSpacing: -2.2, fontWeight: 600,
          margin: '22px 0 18px', maxWidth: 900, textWrap:'balance',
        }}>
          One calm place to run<br/>
          every social channel.
        </h1>

        <p style={{ fontSize: 19, lineHeight: 1.5, color: BRAND.ink2, maxWidth: 540, margin: '0 0 30px', textWrap:'pretty' }}>
          Plan, publish, and reply across eight networks — without the tab chaos. Built for teams who'd rather post than babysit.
        </p>

        {/* CTA row */}
        <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom: 18 }}>
          <div style={{
            display:'flex', alignItems:'center', background:'#fff',
            border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: 4, paddingLeft: 14,
            boxShadow:'0 1px 2px rgba(20,18,40,.04)',
          }}>
            <span style={{ color: BRAND.muted, fontSize: 14 }}>you@company.com</span>
            <div style={{ width: 14 }} />
            <PrimaryBtn>Start free</PrimaryBtn>
          </div>
          <GhostBtn>Watch 90-sec demo</GhostBtn>
        </div>

        <div style={{ fontSize: 12.5, color: BRAND.muted, display:'flex', gap: 16 }}>
          <span>✓ Free forever plan</span>
          <span>✓ No credit card</span>
          <span>✓ SOC 2 · GDPR</span>
        </div>

        {/* Trust row: avatars + rating + count */}
        <div style={{
          display:'flex', alignItems:'center', gap: 18, marginTop: 36,
          padding:'14px 22px', background:'#fff', border:`1px solid ${BRAND.line}`,
          borderRadius: 99, boxShadow:'0 1px 2px rgba(20,18,40,.03)',
        }}>
          <Avatars />
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <Stars />
              <span style={{ fontWeight:600, fontSize:13 }}>4.9</span>
            </div>
            <span style={{ fontSize:12, color: BRAND.muted }}>from 2,480 reviews</span>
          </div>
          <div style={{ width:1, height: 28, background: BRAND.line }}/>
          <div style={{ fontSize: 13, color: BRAND.ink2 }}>
            <b style={{ color: BRAND.ink }}>12,400+</b> creators & teams
          </div>
        </div>

        {/* Channel band (organized, not floating) */}
        <div style={{
          position:'absolute', left:0, right:0, bottom: 0,
          padding: '22px 40px', borderTop: `1px solid ${BRAND.line}`, background: 'rgba(251,250,247,.8)',
          backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'space-between',
        }}>
          <div style={{ fontSize: 12, color: BRAND.muted, letterSpacing: 1, textTransform:'uppercase', fontWeight:600 }}>
            Connects to
          </div>
          <div style={{ display:'flex', gap: 42, alignItems:'center' }}>
            {channels.map(c => (
              <div key={c.k} style={{ display:'flex', alignItems:'center', gap: 8, color: BRAND.ink2, opacity:.75 }}>
                <div style={{ width: 18, height: 18, color: BRAND.ink2 }}>{Ch[c.k](BRAND.ink2)}</div>
                <span style={{ fontSize: 12.5, fontWeight: 500 }}>{c.name}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: BRAND.muted }}>+ Pinterest, Threads…</div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// V2 — Split: copy left, unified-inbox product preview right.
// Leads with product proof — the strongest trust signal.
// ═══════════════════════════════════════════════════════════════
function HeroV2({ width = 1280, height = 820 }) {
  return (
    <div style={{ width, height, background: BRAND.bg, fontFamily:'Inter, -apple-system, sans-serif', color: BRAND.ink, overflow:'hidden', position:'relative' }}>
      <Nav width={width} />

      <div style={{ display:'grid', gridTemplateColumns: '1fr 1.05fr', gap: 56, padding: '72px 56px 0', alignItems:'start' }}>
        {/* LEFT: copy */}
        <div style={{ paddingTop: 18 }}>
          <Eyebrow>Trusted by 12,400+ teams</Eyebrow>

          <h1 style={{
            fontSize: 64, lineHeight: 1.02, letterSpacing: -1.8, fontWeight: 600,
            margin: '22px 0 18px', textWrap:'balance',
          }}>
            Your social desk,
            <br/>
            <span style={{ color: BRAND.purple }}>finally quiet.</span>
          </h1>

          <p style={{ fontSize: 18, lineHeight: 1.55, color: BRAND.ink2, maxWidth: 460, margin: '0 0 28px' }}>
            Basiret consolidates eight networks into one calendar and one inbox — so the team ships on schedule and nothing slips through the DMs.
          </p>

          <div style={{ display:'flex', gap: 10, marginBottom: 22 }}>
            <PrimaryBtn>Start free — 14 day trial</PrimaryBtn>
            <GhostBtn>Book a demo</GhostBtn>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:14, fontSize:13, color: BRAND.muted, marginBottom: 36 }}>
            <span>No credit card</span>
            <span style={{ width:3, height:3, borderRadius:3, background: BRAND.muted, opacity:.5 }}/>
            <span>Cancel anytime</span>
            <span style={{ width:3, height:3, borderRadius:3, background: BRAND.muted, opacity:.5 }}/>
            <span>SOC 2 Type II</span>
          </div>

          {/* customer logos placeholder row */}
          <div style={{ paddingTop: 24, borderTop: `1px solid ${BRAND.line}` }}>
            <div style={{ fontSize: 11.5, color: BRAND.muted, letterSpacing: 1.4, textTransform:'uppercase', fontWeight: 600, marginBottom: 14 }}>
              Chosen by editorial, studio & agency teams
            </div>
            <div style={{ display:'flex', gap: 34, alignItems:'center', flexWrap:'wrap' }}>
              {['ATLAS&CO', 'NOVELA', 'KARAVAN', 'field notes', 'Mirage'].map(n => (
                <div key={n} style={{
                  fontFamily:'Georgia, serif', fontSize: 16, color: BRAND.ink2, opacity:.55,
                  letterSpacing: n==='field notes'? 0 : 2, fontStyle: n==='field notes'?'italic':'normal',
                  fontWeight: n==='NOVELA' || n==='KARAVAN' || n==='ATLAS&CO' ? 700 : 400,
                }}>{n}</div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: product preview (unified inbox + queue) */}
        <div style={{ position:'relative', paddingRight: 0 }}>
          {/* soft glow */}
          <div style={{ position:'absolute', inset:'-20px -40px -20px -20px', background:'radial-gradient(ellipse at 60% 40%, rgba(91,59,232,.10), transparent 65%)' }}/>

          <div style={{
            position:'relative', background:'#fff', borderRadius: 16,
            border: `1px solid ${BRAND.line}`,
            boxShadow:'0 1px 2px rgba(20,18,40,.04), 0 30px 60px -20px rgba(20,18,40,.18)',
            overflow:'hidden',
          }}>
            {/* window chrome */}
            <div style={{ padding:'11px 14px', borderBottom:`1px solid ${BRAND.line}`, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{width:10,height:10,borderRadius:99,background:'#E96A6A'}}/>
              <span style={{width:10,height:10,borderRadius:99,background:'#E9C76A'}}/>
              <span style={{width:10,height:10,borderRadius:99,background:'#6ACB89'}}/>
              <div style={{ flex:1, textAlign:'center', fontSize: 11.5, color: BRAND.muted }}>basiret.com / inbox</div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'180px 1fr', minHeight: 440 }}>
              {/* sidebar */}
              <div style={{ padding:'14px 10px', borderRight:`1px solid ${BRAND.line}`, background:'#FAF8F3', fontSize:13 }}>
                <div style={{ fontSize:11, color:BRAND.muted, letterSpacing:1, textTransform:'uppercase', fontWeight:600, padding:'4px 8px 8px' }}>Inbox</div>
                {[
                  {n:'All', c: 47, a:true},
                  {n:'Mentions', c: 12},
                  {n:'DMs', c: 8},
                  {n:'Comments', c: 27},
                ].map(r => (
                  <div key={r.n} style={{ display:'flex', justifyContent:'space-between', padding:'7px 8px', borderRadius:7, background: r.a? BRAND.purpleSoft:'transparent', color: r.a? BRAND.purple : BRAND.ink2, fontWeight: r.a? 600:500, marginBottom:2 }}>
                    <span>{r.n}</span><span style={{ fontSize:11, opacity:.8 }}>{r.c}</span>
                  </div>
                ))}
                <div style={{ fontSize:11, color:BRAND.muted, letterSpacing:1, textTransform:'uppercase', fontWeight:600, padding:'14px 8px 8px' }}>Channels</div>
                {channels.slice(0,6).map(c => (
                  <div key={c.k} style={{ display:'flex', alignItems:'center', gap:9, padding:'6px 8px', color: BRAND.ink2 }}>
                    <div style={{ width:14, height:14 }}>{Ch[c.k](c.c)}</div>
                    <span style={{ fontSize: 12.5 }}>{c.name}</span>
                  </div>
                ))}
              </div>

              {/* list of conversations */}
              <div>
                {[
                  {ch:'ig', c:'#C93B7B', who:'@lena.writes',     msg:'is the discount still live? 🥺', t:'2m',  unread:true},
                  {ch:'x',  c:'#151324', who:'Mira K.',           msg:'retweeted your launch post',       t:'6m'},
                  {ch:'li', c:'#0A66C2', who:'Samir / ATLAS&CO',  msg:'Would love to feature this in our weekly digest.', t:'14m', unread:true},
                  {ch:'yt', c:'#D72828', who:'3 new comments',    msg:'on "How we ship a post in 9 min"', t:'34m'},
                  {ch:'tt', c:'#151324', who:'@nooraart',         msg:'duetted your clip — huge reach 👀', t:'1h'},
                  {ch:'th', c:'#151324', who:'Jules',             msg:'Thread replies need a response from the team.', t:'2h'},
                ].map((r,i) => (
                  <div key={i} style={{
                    display:'grid', gridTemplateColumns:'28px 1fr auto', gap:12,
                    padding:'14px 18px', borderBottom: i<5 ? `1px solid ${BRAND.line}` : 'none',
                    background: i===0? 'rgba(91,59,232,.03)': '#fff', alignItems:'center',
                  }}>
                    <div style={{ width:28, height:28, borderRadius:7, background: r.c+'15', color: r.c, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <div style={{ width:16, height:16 }}>{Ch[r.ch](r.c)}</div>
                    </div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{r.who}</span>
                        {r.unread && <span style={{ width:6, height:6, borderRadius:6, background: BRAND.purple }}/>}
                      </div>
                      <div style={{ color: BRAND.ink2, fontSize: 13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.msg}</div>
                    </div>
                    <div style={{ fontSize: 11.5, color: BRAND.muted }}>{r.t}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* floating stat card */}
          <div style={{
            position:'absolute', right: -20, bottom: 34,
            background:'#fff', border:`1px solid ${BRAND.line}`, borderRadius: 12,
            padding:'12px 14px', boxShadow:'0 12px 30px -10px rgba(20,18,40,.18)',
            display:'flex', gap:12, alignItems:'center',
          }}>
            <div style={{ width:34, height: 34, borderRadius:8, background: '#E8F6EE', color: BRAND.green, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 11l4-4 3 3 5-6"/><path d="M11 4h3v3"/></svg>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>+34% reply rate</div>
              <div style={{ fontSize: 11.5, color: BRAND.muted }}>vs. last 30 days</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// V3 — Editorial dark. Bilingual, confident, organized constellation.
// "Trust bank" vibe with warm neutral + single accent.
// ═══════════════════════════════════════════════════════════════
function HeroV3({ width = 1280, height = 820 }) {
  const DARK = '#1A1726';
  const DARK2 = '#221E33';
  const CREAM = '#F5F2EC';
  const MUTE = 'rgba(245,242,236,.62)';
  return (
    <div style={{ width, height, background: DARK, fontFamily:'Inter, -apple-system, sans-serif', color: CREAM, position:'relative', overflow:'hidden' }}>
      {/* subtle ornament */}
      <div style={{
        position:'absolute', top: -200, right: -220, width: 700, height: 700, borderRadius: 999,
        background:'radial-gradient(circle, rgba(91,59,232,.26), transparent 60%)', filter:'blur(10px)',
      }}/>
      <Nav width={width} variant="dark" />

      <div style={{ display:'grid', gridTemplateColumns:'1.1fr 1fr', padding:'56px 56px 0', gap: 40, alignItems:'center', position:'relative' }}>
        {/* LEFT: editorial type */}
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom: 28, color: MUTE, fontSize: 13 }}>
            <div style={{ width: 28, height: 1, background: MUTE }}/>
            <span style={{ letterSpacing: 2, textTransform:'uppercase', fontSize: 11.5 }}>Basiret · est. Amman 2024</span>
          </div>

          <h1 style={{
            fontFamily:'"Fraunces", "Playfair Display", Georgia, serif',
            fontSize: 92, lineHeight: 0.96, letterSpacing:-2.4, fontWeight: 400,
            margin: '0 0 14px',
          }}>
            Post <em style={{ fontStyle:'italic', color:'#B9A3FF' }}>less.</em><br/>
            Be <em style={{ fontStyle:'italic', color:'#B9A3FF' }}>heard</em> more.
          </h1>

          <div style={{
            fontSize: 22, fontFamily:'"Noto Naskh Arabic", "Amiri", serif',
            direction:'rtl', color: MUTE, marginBottom: 22, letterSpacing: 0.5,
          }}>
            ‏انشر أقل. كن مسموعًا أكثر.
          </div>

          <p style={{ fontSize: 17, lineHeight: 1.55, color: MUTE, maxWidth: 440, marginBottom: 30 }}>
            A calm command center for content teams — one calendar, one inbox, eight channels. Built in Amman. Bilingual by default.
          </p>

          <div style={{ display:'flex', gap: 12, alignItems:'center', marginBottom: 30 }}>
            <PrimaryBtn dark>Start free</PrimaryBtn>
            <button style={{
              background:'transparent', border:'none', color: CREAM, fontSize: 14,
              cursor:'pointer', display:'inline-flex', gap:8, alignItems:'center', padding: '12px 4px',
              borderBottom: `1px solid ${MUTE}`,
            }}>
              Read the product notes
              <svg width="12" height="12" viewBox="0 0 14 14"><path d="M3 7h8M7 3l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            </button>
          </div>

          {/* compact trust line */}
          <div style={{ display:'flex', gap: 28, alignItems:'center', color: MUTE, fontSize: 12.5, paddingTop: 20, borderTop: '1px solid rgba(245,242,236,.1)' }}>
            <div>
              <div style={{ color: CREAM, fontSize: 22, fontWeight:500, fontFamily:'"Fraunces", serif', letterSpacing:-0.3 }}>12.4k</div>
              <div>teams</div>
            </div>
            <div style={{ width:1, height:30, background:'rgba(245,242,236,.1)' }}/>
            <div>
              <div style={{ color: CREAM, fontSize: 22, fontWeight:500, fontFamily:'"Fraunces", serif', letterSpacing:-0.3 }}>4.9★</div>
              <div>G2 · 2,480 reviews</div>
            </div>
            <div style={{ width:1, height:30, background:'rgba(245,242,236,.1)' }}/>
            <div>
              <div style={{ color: CREAM, fontSize: 22, fontWeight:500, fontFamily:'"Fraunces", serif', letterSpacing:-0.3 }}>SOC 2</div>
              <div>& GDPR</div>
            </div>
          </div>
        </div>

        {/* RIGHT: organized channel constellation (circular, not chaotic) */}
        <div style={{ position:'relative', height: 560, display:'flex', alignItems:'center', justifyContent:'center' }}>
          {/* rings */}
          {[150, 230].map((r, i) => (
            <div key={i} style={{
              position:'absolute', width: r*2, height: r*2, borderRadius: 999,
              border: `1px dashed rgba(245,242,236,.12)`,
            }}/>
          ))}

          {/* center card */}
          <div style={{
            width: 200, height: 200, borderRadius: 20, background: DARK2,
            border:'1px solid rgba(245,242,236,.12)',
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap: 10,
            boxShadow:'0 20px 50px -10px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.04)',
            position:'relative', zIndex: 2,
          }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: BRAND.purple, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, letterSpacing:-0.5 }}>
              <span style={{ fontSize: 20, color:'#fff' }}>ب</span>
            </div>
            <div style={{ fontFamily:'"Fraunces", serif', fontSize: 22, letterSpacing:-0.3 }}>Basiret</div>
            <div style={{ fontSize: 11.5, color: MUTE, letterSpacing: 1.2, textTransform:'uppercase' }}>Command center</div>
          </div>

          {/* orbit items — organized at fixed angles */}
          {channels.map((c, i) => {
            const angle = (i / channels.length) * Math.PI * 2 - Math.PI/2;
            const radius = 230;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            return (
              <div key={c.k} style={{
                position:'absolute', transform:`translate(${x}px, ${y}px)`,
                width: 52, height: 52, borderRadius: 14, background: DARK2,
                border:'1px solid rgba(245,242,236,.12)',
                display:'flex', alignItems:'center', justifyContent:'center',
                color: CREAM, boxShadow:'0 10px 24px -8px rgba(0,0,0,.5)',
              }}>
                <div style={{ width: 22, height: 22, color: CREAM }}>{Ch[c.k](CREAM)}</div>
              </div>
            );
          })}

          {/* inner activity dots */}
          {channels.slice(0,4).map((c,i) => {
            const angle = (i / 4) * Math.PI * 2 + Math.PI/4;
            const r = 150;
            return (
              <div key={i} style={{
                position:'absolute', transform:`translate(${Math.cos(angle)*r}px, ${Math.sin(angle)*r}px)`,
                padding:'7px 11px', borderRadius: 99, background: 'rgba(245,242,236,.06)',
                border:'1px solid rgba(245,242,236,.1)', color: CREAM, fontSize: 11.5,
                display:'flex', gap:6, alignItems:'center', backdropFilter:'blur(10px)',
              }}>
                <span style={{ width:6, height:6, borderRadius:6, background: i===0? BRAND.green : i===1? '#B9A3FF' : MUTE }}/>
                {['queued · 12', 'replied · 8', 'scheduled · 34', 'draft · 3'][i]}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { HeroV1, HeroV2, HeroV3 });
