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
              <circle cx="7" cy="7" r="6.5" stroke="#D5D5D5" />
              <path d="M4 7L6 9L10 5" stroke="#D5D5D5" />
            </svg>
            Asset Allocation
          </span>
          <span className="landing-feature">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="7" cy="7" r="6.5" stroke="#D5D5D5" />
              <path d="M4 7L6 9L10 5" stroke="#D5D5D5" />
            </svg>
            AI Insights
          </span>
          <span className="landing-feature">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="7" cy="7" r="6.5" stroke="#D5D5D5" />
              <path d="M4 7L6 9L10 5" stroke="#D5D5D5" />
            </svg>
            Performance Analytics
          </span>
        </div>
        <h1 className="landing-title"><span className="landing-title-line"><em className="landing-title-em">Simplified</em> Property Tracking</span></h1>
        <p className="landing-tagline">
            Track rental income, expenses, and portfolio performance with a clear, intuitive dashboard.
        </p>
        <div className="landing-logo">
          <svg width="90" height="90" viewBox="0 0 90 90" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="65.6367" y="30.0342" width="12.3568" height="52.4532" fill="#6D2F20"/>
            <rect x="38.832" y="30.3232" width="12.2887" height="52.1643" fill="#6D2F20"/>
            <rect x="12" y="30.3232" width="12.2887" height="52.1643" fill="#6D2F20"/>
            <path d="M78.001 30.3232H65.623C65.5666 22.9727 59.5914 17.0313 52.2275 17.0312C44.8636 17.0312 38.8884 22.9726 38.832 30.3232H24.332V7H78.001V30.3232Z" fill="#6D2F20"/>
          </svg>
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
