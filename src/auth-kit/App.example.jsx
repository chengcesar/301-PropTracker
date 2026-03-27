/**
 * Example App.jsx showing how to wire up the auth-kit.
 *
 * Dependencies:
 *   npm install firebase react-router-dom
 *
 * 1. Copy auth-kit/ into your src/ (or adjust import paths)
 * 2. Import auth.css in your main entry (main.jsx or App.jsx)
 * 3. Add Inter + Averia Serif Libre fonts to your index.html:
 *      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Averia+Serif+Libre:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
 * 4. Copy public/images/ to your project's public/ folder
 * 5. Create .env from .env.example with your Firebase config
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';
import Header from './components/Header';
import './auth.css';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? children : <Navigate to="/login" />;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return null;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/" element={
        user ? (
          <>
            <Header />
            <div style={{ padding: 40 }}>
              <h1>Welcome, {user.displayName || user.email}</h1>
              <p>You are logged in. Replace this with your app content.</p>
            </div>
          </>
        ) : (
          <LandingPage />
        )
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
