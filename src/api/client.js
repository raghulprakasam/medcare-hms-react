// Central API client. All backend endpoints and payload shapes are
// preserved EXACTLY as they were in the original vanilla-JS pages
// (Mainpage/script.js, PatientPage/script.js, DoctorPage/doctor.html,
// AdminPage/admin.html, PharmacyDashboard/pharmacy-dashboard.html).


export const API_BASE = "https://spring-boot-jwt-rbac.onrender.com";



export function getToken() {
  return localStorage.getItem("accessToken");
}

export function setToken(token) {
  localStorage.setItem("accessToken", token);
}

export function clearToken() {
  localStorage.removeItem("accessToken");
}

function authHeaders(extra = {}) {
  const token = getToken();
  return {
    ...(token ? { Authorization: "Bearer " + token } : {}),
    ...extra,
  };
}

/**
 * apiFetch - thin wrapper around fetch() that:
 *  - Prefixes the configured API_BASE
 *  - Attaches the Bearer token from localStorage when present
 *  - Optionally JSON-encodes the body
 *
 * Behaves like a plain fetch() call otherwise (returns a Response),
 * so existing `.ok` / `.json()` handling patterns keep working
 * unchanged, exactly like the original code.
 */
export async function apiFetch(path, { method = "GET", body, json = true, headers = {} } = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const finalHeaders = json
    ? authHeaders({ "Content-Type": "application/json", ...headers })
    : authHeaders(headers);

  return fetch(url, {
    method,
    headers: finalHeaders,
    body: body !== undefined ? (json ? JSON.stringify(body) : body) : undefined,
  });
}

/** Decode the `sub` claim out of the JWT access token (same atob-based
 * approach the legacy pages used for loadProfile()). */
export function decodeTokenSubject(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub || null;
  } catch (e) {
    return null;
  }
}
