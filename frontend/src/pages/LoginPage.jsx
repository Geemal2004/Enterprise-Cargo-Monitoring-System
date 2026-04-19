import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthContext } from "../context/AuthContext";

function extractErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Login failed. Verify your credentials and try again."
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { initializing, isAuthenticated, login } = useAuthContext();

  const redirectPath = useMemo(() => {
    if (location.state && typeof location.state.from === "string" && location.state.from) {
      return location.state.from;
    }
    return "/fleet";
  }, [location.state]);

  const [email, setEmail] = useState("admin@demo.local");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!initializing && isAuthenticated) {
      navigate(redirectPath, { replace: true });
    }
  }, [initializing, isAuthenticated, navigate, redirectPath]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await login(email.trim(), password);
      navigate(redirectPath, { replace: true });
    } catch (loginError) {
      setError(extractErrorMessage(loginError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <section className="auth-panel panel-surface">
        <p className="eyebrow">Enterprise Access</p>
        <h1 className="auth-title">Smart Cargo Monitoring</h1>
        <p className="auth-subtitle">
          Sign in with your tenant account to access fleet telemetry, alerts, and admin controls.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="form-label" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            className="form-input"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={submitting}
            required
          />

          <label className="form-label" htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            className="form-input"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={submitting}
            required
          />

          {error ? <div className="error-box">{error}</div> : null}

          <button type="submit" className="auth-submit" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="auth-footnote">
          Need operations dashboard access? Return to <Link to="/fleet">Fleet Overview</Link> after login.
        </p>
      </section>
    </div>
  );
}
