import React from 'react';
import { Link } from 'react-router-dom';

const workflows = [
  {
    number: '01',
    title: 'Customs verification',
    description: 'Review submitted cargo records, check them against your own records, and approve or return them with a clear audit trail.',
    action: 'Customs & AGL sign in',
    to: '/login',
    icon: 'check',
  },
  {
    number: '02',
    title: 'Warehouse operations',
    description: 'Keep your storage listing up to date, respond to booking requests, and record goods at check-in and check-out.',
    action: 'Warehouse portal',
    to: '/warehouse/login',
    icon: 'warehouse',
  },
];

function BrandMark() {
  return <span className="landing-brand-mark" aria-hidden="true">C</span>;
}

function WorkflowIcon({ name }: { name: string }) {
  return name === 'check' ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12.5 9.2 17 19 7" />
      <path d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 21V8l9-5 9 5v13" />
      <path d="M3 9h18M8 21v-7h8v7M7 12h.01M12 12h.01M17 12h.01" />
    </svg>
  );
}

export function LandingPage() {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <Link className="landing-brand" to="/" aria-label="Cargo Flow home">
          <BrandMark />
          <span>Cargo<span className="landing-brand-light">Flow</span></span>
        </Link>
        <nav className="landing-nav" aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#workflows">Portals</a>
          <Link className="landing-nav-cta" to="/login">Staff sign in <span aria-hidden="true">→</span></Link>
        </nav>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <div className="landing-eyebrow"><span /> CARGO OPERATIONS, CONNECTED</div>
            <h1>Move cargo forward.<br /><span>With clarity.</span></h1>
            <p className="landing-hero-description">
              One coordinated workspace for cargo verification and warehouse operations, connecting the people and steps that keep shipments moving.
            </p>
            <div className="landing-hero-actions">
              <Link className="landing-button landing-button-primary" to="/login">Access the staff portal <span aria-hidden="true">→</span></Link>
              <a className="landing-button landing-button-quiet" href="#how-it-works">Explore Cargo Flow <span aria-hidden="true">↓</span></a>
            </div>
            <div className="landing-assurance">
              <span className="landing-assurance-icon" aria-hidden="true">✓</span>
              <span>Clear handoffs <i /> Accountable decisions <i /> One shared view</span>
            </div>
          </div>

          <div className="landing-visual" role="img" aria-label="Cargo Flow process illustration">
            <div className="landing-visual-grid" />
            <div className="landing-visual-orbit landing-visual-orbit-one" />
            <div className="landing-visual-orbit landing-visual-orbit-two" />
            <div className="landing-visual-label"><span className="landing-live-dot" /> A MORE CONNECTED FLOW</div>
            <div className="landing-route">
              <div className="landing-route-line"><span /><span /><span /></div>
              <div className="landing-route-node landing-route-node-one">
                <span className="landing-route-icon">01</span>
                <span className="landing-route-caption">SUBMIT</span>
              </div>
              <div className="landing-route-node landing-route-node-two">
                <span className="landing-route-icon landing-route-icon-active">02</span>
                <span className="landing-route-caption">VERIFY</span>
              </div>
              <div className="landing-route-node landing-route-node-three">
                <span className="landing-route-icon">03</span>
                <span className="landing-route-caption">MOVE</span>
              </div>
              <div className="landing-cargo-card">
                <div className="landing-cargo-symbol" aria-hidden="true">
                  <span /><span /><span /><span /><span /><span />
                </div>
                <div><strong>Every step, in view.</strong><small>From verification to storage</small></div>
                <span className="landing-cargo-arrow" aria-hidden="true">↗</span>
              </div>
            </div>
            <div className="landing-visual-footer"><span>BUILT FOR BETTER HANDOFFS</span><span>SIERRA LEONE <b>·</b> CARGO FLOW</span></div>
          </div>
        </section>

        <section className="landing-how" id="how-it-works">
          <div className="landing-section-heading">
            <div>
              <div className="landing-eyebrow">A CLEARER WAY TO WORK</div>
              <h2>Fewer gaps between<br />the people moving cargo.</h2>
            </div>
            <p>Bring cargo records, verification, approvals, and storage coordination into a connected flow built around clear responsibilities.</p>
          </div>
          <div className="landing-feature-row">
            <article className="landing-feature">
              <span className="landing-feature-number">01 / TRACK</span>
              <h3>Know what’s happening</h3>
              <p>Follow records from submission through review, with their status and history easy to find.</p>
            </article>
            <article className="landing-feature">
              <span className="landing-feature-number">02 / COORDINATE</span>
              <h3>Make handoffs clearer</h3>
              <p>Give Customs and AGL teams a shared, role-appropriate view of submitted and approved records.</p>
            </article>
            <article className="landing-feature">
              <span className="landing-feature-number">03 / CONNECT</span>
              <h3>Bring storage into view</h3>
              <p>Help clearing agents discover verified warehouse space and let owners manage bookings in one place.</p>
            </article>
          </div>
        </section>

        <section className="landing-portals" id="workflows">
          <div className="landing-portals-heading">
            <div>
              <div className="landing-eyebrow">YOUR WORKSPACE</div>
              <h2>Choose where to begin.</h2>
            </div>
            <p>Sign in to your portal to continue your work.</p>
          </div>
          <div className="landing-workflow-grid">
            {workflows.map((workflow) => (
              <article className="landing-workflow-card" key={workflow.number}>
                <div className="landing-workflow-topline">
                  <span>{workflow.number} <i /> CARGO FLOW</span>
                  <span className="landing-workflow-icon"><WorkflowIcon name={workflow.icon} /></span>
                </div>
                <h3>{workflow.title}</h3>
                <p>{workflow.description}</p>
                <Link to={workflow.to} className="landing-workflow-link">{workflow.action}<span aria-hidden="true">→</span></Link>
              </article>
            ))}
          </div>
          <div className="landing-warehouse-signup">
            <span>Have storage space to offer?</span>
            <Link to="/warehouse/signup">Create a warehouse account <span aria-hidden="true">↗</span></Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <Link className="landing-brand" to="/" aria-label="Cargo Flow home"><BrandMark /><span>Cargo<span className="landing-brand-light">Flow</span></span></Link>
        <span>Connected cargo operations. Clearer at every step.</span>
        <a href="#top" onClick={(event) => { event.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Back to top ↑</a>
      </footer>
    </div>
  );
}
