// frontend/app/login/page.tsx
const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
const FRONTEND_DASHBOARD_URL = "http://localhost:3000/dashboard";

export default function LoginPage() {
  return (
    <div className="page">
      <div className="page-left" />

      <div className="page-right">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Sign in</div>
            <div className="card-subtitle">
              New user?{" "}
              <a href={`${BACKEND_URL}/accounts/signup/`}>Create an account</a>
            </div>
          </div>

          {/* Email/password → send user to Django login with ?next= */}
          <p className="muted-text" style={{ marginBottom: 16 }}>
            Prefer email &amp; password?{" "}
            <a
              href={`${BACKEND_URL}/accounts/login/?next=${encodeURIComponent(
                FRONTEND_DASHBOARD_URL
              )}`}
            >
              Use Django login
            </a>
          </p>

          <div className="divider">Or</div>

          {/* Social buttons (Google / Facebook) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <a
              className="social-btn"
              href={`${BACKEND_URL}/accounts/google/login/?next=${encodeURIComponent(
                FRONTEND_DASHBOARD_URL
              )}`}
            >
              <span className="icon" />
              <span>Continue with Google</span>
            </a>
            <a
              className="social-btn"
              href={`${BACKEND_URL}/accounts/facebook/login/?next=${encodeURIComponent(
                FRONTEND_DASHBOARD_URL
              )}`}
            >
              <span className="icon" />
              <span>Continue with Facebook</span>
            </a>
          </div>

          <div style={{ marginTop: 16 }}>
            <p className="muted-text">
              By continuing, you agree to our Terms and acknowledge our Privacy
              Policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
