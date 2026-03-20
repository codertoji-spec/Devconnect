import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

// Context = a way to share state globally without passing props through every component
// Think of it as a global variable that any component can read/update

const AuthContext = createContext(null);

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // True while checking if user is logged in

  // On app load, check if token exists in localStorage and validate it
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      axios
        .get(`${API}/auth/me`)
        .then((res) => setUser(res.data.user))
        .catch(() => {
          // Token invalid/expired — clear it
          localStorage.removeItem("token");
          delete axios.defaults.headers.common["Authorization"];
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await axios.post(`${API}/auth/login`, { email, password });
    const { token, user } = res.data;

    // Store token in localStorage — persists across browser refresh
    localStorage.setItem("token", token);
    // Set default auth header for all future axios requests
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    setUser(user);
    return user;
  };

  const register = async (username, email, password) => {
    const res = await axios.post(`${API}/auth/register`, { username, email, password });
    const { token, user } = res.data;

    localStorage.setItem("token", token);
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    setUser(user);
    return user;
  };

  const logout = () => {
    localStorage.removeItem("token");
    delete axios.defaults.headers.common["Authorization"];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook — makes it easy to use auth in any component
// Instead of: const { user } = useContext(AuthContext)
// Just use: const { user } = useAuth()
export const useAuth = () => useContext(AuthContext);
