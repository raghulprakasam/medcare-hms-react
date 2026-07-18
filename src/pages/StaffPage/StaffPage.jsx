import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { clearToken, getToken } from "../../api/client.js";

// NOTE: The original vanilla-JS project redirected "Medical Staff" role
// logins to "../StaffPage/staff-dashboard.html", but that page was not
// included in the supplied HMS.zip (only Mainpage, PatientPage,
// AdminPage, DoctorPage and PharmacyDashboard were present). This is a
// minimal placeholder so that login flow for that role resolves to a
// real page instead of a dead link. Swap in the real dashboard here
// once that page's source is available.
export default function StaffPage() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!getToken()) navigate("/");
  }, [navigate]);

  function logout() {
    clearToken();
    navigate("/");
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", background: "#f8fafb", flexDirection: "column", gap: "16px" }}>
      <h1 style={{ color: "#0B1F3A" }}>Medical Staff Dashboard</h1>
      <p style={{ color: "#4A5E72", maxWidth: "420px", textAlign: "center" }}>
        This page was not part of the original project files (only Admin, Doctor, Pharmacy and Patient dashboards were
        provided). Add the Staff dashboard markup/logic here when available.
      </p>
      <button
        onClick={logout}
        style={{ background: "#0D7377", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}
      >
        Sign Out
      </button>
    </div>
  );
}
