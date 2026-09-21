import { FieldLabel, Input, FieldHint } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useAuthContext } from "../context/AuthContext";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

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

  if (initializing) {
    return (
      <div className="auth-loading-shell">
        <Card className="auth-loading-panel w-full max-w-md">
          <CardContent className="flex items-center gap-3 p-6">
            <Spinner label="Checking session" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Authentication
              </p>
              <h2 className="text-lg font-semibold">Checking session</h2>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <Card className="auth-panel w-full max-w-lg shadow-md">
        <CardContent className="p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Enterprise Access
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            Smart Cargo Monitoring
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with your tenant account to access fleet telemetry, alerts, and admin controls.
          </p>

          <form className="mt-6 grid gap-4" onSubmit={handleSubmit} noValidate>
            <div className="grid gap-1.5">
              <FieldLabel htmlFor="login-email" required>
                Email
              </FieldLabel>
              <Input
                id="login-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={submitting}
                error={Boolean(error)}
                required
              />
            </div>

            <div className="grid gap-1.5">
              <FieldLabel htmlFor="login-password" required>
                Password
              </FieldLabel>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={submitting}
                error={Boolean(error)}
                required
              />
            </div>

            {error ? (
              <Alert tone="error" title="Sign-in failed">
                {error}
              </Alert>
            ) : (
              <FieldHint>Use your organization credentials. Sessions expire automatically.</FieldHint>
            )}

            <Button type="submit" loading={submitting} disabled={submitting} className="mt-1 w-full">
              {submitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="mt-5 text-sm text-muted-foreground">
            Need operations dashboard access? Return to{" "}
            <Link to="/fleet" className="font-semibold text-signal hover:underline">
              Fleet Overview
            </Link>{" "}
            after login.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
