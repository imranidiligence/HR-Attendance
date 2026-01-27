import axiosInstance, { scheduleAutoLogout } from "../api/axiosInstance";
import { jwtDecode } from "jwt-decode";
import axios from "axios";
import { toast } from "react-hot-toast";
import api from "../api/axiosInstance";

export const addEmploy = async (data) => {
  // Get the token from wherever you store it (localStorage or Context)
  const token = localStorage.getItem("token"); 

  const response = await axios.post(
    "http://localhost:5000/api/admin/attendance/add-employee", 
    data, 
    {
      headers: {
        // THIS IS THE MISSING PIECE
        "Content-Type":"application/json",
        Authorization: `Bearer ${token}` 
      }
    }
  );
  return response.data;
};

export const loginUser = async (credentials) => {
  const response = await api.post("/auth/login", credentials);

  if (response.data.token) {
    const { token, user } = response.data;

    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));

    // Schedule proactive logout
    scheduleAutoLogout(token);
  }

  return response.data;
};


// export const loginUser= async(credentials)=> {
//   try {
//     const response = await fetch(
//       "http://localhost:5000/api/auth/login",
//       {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json"
//         },
//         body: JSON.stringify(credentials)
//       }
//     );

//     if (!response.ok) {
//       const errorData = await response.json().catch(() => ({}));
//       throw new Error(
//         errorData.message || "Login failed. Please try again."
//       );
//     }

//     const data = await response.json();


//     if (data.token) {
//       localStorage.setItem("token", data.token);
//       if (data.user) {
//         localStorage.setItem("user", JSON.stringify(data.user));
//       }
//     }

//     return data;

//   } catch (error) {
//     console.error("Login error:", error);
//     throw error; // frontend UI me handle karne ke liye
//   }
// }


export const changePassword = async (data) => {
  const response = await axiosInstance.post("/auth/change-password", data);

  // Save token
  if (response.data.token) {
    localStorage.setItem("token", response.data.token);
    localStorage.setItem("user",JSON.stringify(response.data.user));
  }

  return response.data;
};


export const logoutUser = () => {
  localStorage.removeItem("token");
};
