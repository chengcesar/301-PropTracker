import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="landing-page">
      <div className="landing-overlay" />
      <div className="landing-content">
        <div className="landing-content-inner">
        <div className="landing-features">
          <span className="landing-feature">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="7" cy="7" r="6.5" stroke="currentColor" />
              <path d="M4 7L6 9L10 5" stroke="currentColor" />
            </svg>
            Income Tracking
          </span>
          <span className="landing-feature">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="7" cy="7" r="6.5" stroke="currentColor" />
              <path d="M4 7L6 9L10 5" stroke="currentColor" />
            </svg>
            AI Monthly Reports
          </span>
          <span className="landing-feature">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="7" cy="7" r="6.5" stroke="currentColor" />
              <path d="M4 7L6 9L10 5" stroke="currentColor" />
            </svg>
            Performance Analytics
          </span>
        </div>
        <h1 className="landing-title"><span className="landing-title-line"><em className="landing-title-em">Simplified</em> Portfolio Tracking</span></h1>
        <p className="landing-tagline">
          Monitor income, expenses, and portfolio performance across all your properties in one place.
        </p>
        <div className="landing-logo">
          <img src="/App-Icon.svg" alt="" width={90} height={90} />
        </div>
        <div className="landing-cta-row">
          <Link to="/login" className="landing-cta">
            Try it for free
          </Link>
          <Link to="/login" className="landing-cta landing-cta-secondary">
            Login
          </Link>
        </div>
        </div>
        <div className="landing-preview">
          <img src="/images/placeholder.png" alt="App preview" />
        </div>
      </div>
    </div>
  );
}
