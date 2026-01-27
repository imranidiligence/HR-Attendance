import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { loginUser } from "../../services/authServices";
import LoginImg from "../assets/HR-login(2).png";
import logo from "../assets/ids-logo.png"

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // New state for inline validation errors
  const [errors, setErrors] = useState({});

  const validate = () => {
    let tempErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // This regex matches a numeric ID (adjust if your IDs have letters)
    const empIdRegex = /^[0-9]+$/;

    if (!email) {
      tempErrors.email = "Email or User ID is required";
    } else {
      // Check if it's a valid email OR a valid numeric ID
      const isValidEmail = emailRegex.test(email);
      const isValidEmpId = empIdRegex.test(email);

      if (!isValidEmail && !isValidEmpId) {
        tempErrors.email = "Please enter a valid Email or Employee ID";
      }
    }

    if (!password) {
      tempErrors.password = "Password is required";
    } else if (password.length < 6) {
      tempErrors.password = "Password must be at least 6 characters";
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };
  const handleLogin = async (e) => {
    if (e) e.preventDefault();

    setErrors({});
    const isValid = validate();
    if (!isValid) return;

    setLoading(true);

    try {
      const resp = await loginUser({ email, password });
      localStorage.setItem("token", resp.token);
      localStorage.setItem("user", JSON.stringify(resp.user));

      window.dispatchEvent(new Event("storage"));
      toast.success("Welcome to HR Attendance System");


      if (resp.user.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/employee");
      }
    } catch (err) {
      // 3. Handle error without refreshing
      const errorMessage = err.response?.data?.message || "Invalid credentials";
      toast.error(errorMessage);

      // Optional: highlight the input fields as red
      setErrors({ auth: errorMessage });
    } finally {
      // 4. Always turn off loading, which re-enables the button
      setLoading(false);
    }
  };
  return (
    <div className="flex flex-col gap-12 min-h-screen overflow-hidden items-center justify-center bg-white px-4">
      {/* Header Section */}
      <div className="flex w-full mx-auto items-center justify-around mb-4">
        <img src={logo} alt="Logo" className="mb-4 w-[80px] h-auto -ml-[40px] mt-[9px]" />
        <h2 className="mb-5 text-center text-3xl font-bold text-[#0033A0]">
          Welcome To Idiligence HR Application
        </h2>
      </div>

      <div className="flex w-full items-center justify-center gap-10">
        {/* Left Image */}
        <div className="hidden md:flex md:w-1/2 justify-center ">
          <img src={LoginImg} alt="Login Illustration" className="w-[500px] h-auto" />
        </div>

        {/* Login Card */}
        <div className="w-full md:w-1/2 flex justify-center">
          <div className="w-[450px] min-h-max rounded-lg bg-[#f5faff] p-8 shadow-md flex flex-col">
            <h2 className="mb-10 text-center text-2xl font-semibold text-[#0033a0]">Login</h2>

            <form onSubmit={handleLogin} className="flex-1">
              {/* User ID / Email */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="User ID / Email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    // Clear the error so the red border goes away while typing
                    if (errors.email) {
                      const updatedErrors = { ...errors };
                      delete updatedErrors.email;
                      setErrors(updatedErrors);
                    }
                  }}
                  className={`w-full rounded border ${errors.email ? 'border-red-500' : 'border-gray-300'
                    } px-4 py-2 focus:border-[#0033a0] focus:outline-none`}
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </div>

              {/* Password */}
              <div className="relative mb-4">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors({ ...errors, password: "" }); // Clear error on type
                  }}
                  className={`w-full rounded border ${errors.password ? 'border-red-500' : 'border-gray-300'} px-4 py-2 focus:border-[#0033a0] focus:outline-none`}
                />
                <span
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 cursor-pointer text-sm font-medium text-gray-500"
                >
                  {showPassword ? "Hide" : "Show"}
                </span>
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
              </div>

              {/* Remember / Forgot */}
              <div className="my-6 flex items-center justify-between text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="accent-[#0033a0]" /> Remember me
                </label>
                <button type="button" className="font-medium text-[#0033a0] hover:underline">
                  Forgot Password?
                </button>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded bg-black py-2 font-bold text-white hover:bg-gray-900 transition disabled:opacity-60 flex justify-center items-center"
              >
                LOGIN
              </button>

              <p className="mt-8 text-center text-[10px] text-gray-500">
                DESIGNED AND DEVELOPED BY {" "}
                <span className="font-bold text-[#0033a0]">IDILIGENCE SOLUTIONS PVT LTD</span>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}