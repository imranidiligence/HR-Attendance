import axios from "axios";
import { toast } from "react-hot-toast";
import {jwtDecode} from "jwt-decode";

let logoutTimeout;
let isRedirecting = false;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isRedirecting) {
      triggerLogout("Session expired. Please login again.");
    }
    return Promise.reject(error);
  }
);

// Central logout function
export const triggerLogout = (message) => {
  isRedirecting = true;

  clearTimeout(logoutTimeout); // Clear any existing timer
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.dispatchEvent(new Event("storage"));

  if (message) toast.error(message);

  setTimeout(() => {
    window.location.replace("/login");
  }, 500);
};

// Proactively schedule logout based on JWT expiry
export const scheduleAutoLogout = (token) => {
  try {
    const decoded = jwtDecode(token);
    const expiryTime = decoded.exp * 1000; // JWT exp in ms
    const now = Date.now();
    const timeout = expiryTime - now;

    if (timeout > 0) {
      logoutTimeout = setTimeout(() => {
        triggerLogout("Session expired. Please login again.");
      }, timeout);
    }
  } catch (err) {
    console.error("Failed to schedule auto logout:", err);
  }
};

export default api;
