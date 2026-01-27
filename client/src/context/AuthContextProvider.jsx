import { createContext, useEffect, useState } from "react";

export const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

const triggerRefresh = () => setRefreshTrigger(prev => prev + 1);
  
const token = localStorage.getItem("token")
  useEffect(() => {


    if (token) {
      setUser({ token }); // minimal info
    }

    setLoading(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading,token,refreshTrigger, triggerRefresh}}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
