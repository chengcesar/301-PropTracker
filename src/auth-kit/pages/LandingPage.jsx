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
              <circle cx="7" cy="7" r="6.5" stroke="#0539FF" />
              <path d="M4 7L6 9L10 5" stroke="#0539FF" />
            </svg>
            Income Tracking
          </span>
          <span className="landing-feature">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="7" cy="7" r="6.5" stroke="#0539FF" />
              <path d="M4 7L6 9L10 5" stroke="#0539FF" />
            </svg>
            AI Insights
          </span>
          <span className="landing-feature">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="7" cy="7" r="6.5" stroke="#0539FF" />
              <path d="M4 7L6 9L10 5" stroke="#0539FF" />
            </svg>
            Performance Analytics
          </span>
        </div>
        <h1 className="landing-title"><span className="landing-title-line"><em className="landing-title-em">Simplified</em> Portfolio Tracking</span></h1>
        <p className="landing-tagline">
          Monitor income, expenses, and portfolio performance across all your properties in one place.
        </p>
        <div className="landing-logo">
          <svg width="90" height="90" viewBox="0 0 90 90" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M35.4551 56.9697C35.4551 56.384 35.9299 55.9091 36.5157 55.9091H54.546C55.1317 55.9091 55.6066 56.384 55.6066 56.9697V84.5455C55.6066 85.1312 55.1317 85.6061 54.546 85.6061H36.5157C35.9299 85.6061 35.4551 85.1312 35.4551 84.5455V56.9697Z" fill="#0539FF"/>
            <path d="M10 73.9394C10 73.3536 10.4748 72.8788 11.0606 72.8788H29.0909C29.6767 72.8788 30.1515 73.3536 30.1515 73.9394V84.5455C30.1515 85.1312 29.6767 85.6061 29.0909 85.6061H11.0606C10.4749 85.6061 10 85.1312 10 84.5455L10 73.9394Z" fill="#0539FF"/>
            <path d="M59.8477 46.2459C59.8477 45.6601 60.3225 45.1852 60.9083 45.1852H78.9386C79.5243 45.1852 79.9992 45.6601 79.9992 46.2458V84.4277C79.9992 85.0134 79.5243 85.4883 78.9386 85.4883H60.9083C60.3225 85.4883 59.8477 85.0134 59.8477 84.4277V46.2459Z" fill="#0539FF"/>
            <path d="M10 40C10 20.67 25.67 5 45 5C63.6176 5 78.8401 19.5364 79.9368 37.8785C80.0067 39.0479 79.0503 40 77.8788 40H61.3805C60.209 40 59.2758 39.0448 59.1036 37.886C58.0822 31.0133 52.1568 25.7407 45 25.7407C37.1248 25.7407 30.7407 32.1248 30.7407 40V65.9848C30.7407 67.1564 29.791 68.1061 28.6195 68.1061H12.1212C10.9497 68.1061 10 67.1564 10 65.9848V40Z" fill="#0539FF"/>
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
