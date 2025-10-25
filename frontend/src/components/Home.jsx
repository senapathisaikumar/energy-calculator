import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, User, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { apiFetch } from "../api";

const Home = () => {
  const [name, setName] = useState("");
  const [mail, setMail] = useState("");
  const [otp, setOtp] = useState("");
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [showOtp, setShowOtp] = useState(false); // 👁️ toggle state
  const navigate = useNavigate();

  const send_otp = async () => {
    if (!name || !mail) return alert("Please enter your name and email!");
    try {
      await apiFetch("/send-otp", {
        method: "POST",
        body: JSON.stringify({ mail, name }),
      });
      setIsOtpSent(true);
      alert("OTP sent successfully!");
    } catch (error) {
      console.error(error);
      alert(error.message || "Network error while sending OTP.");
    }
  };

  const validate_otp = async () => {
    if (!mail || !otp) return alert("Please enter your email and OTP!");
    try {
      const result = await apiFetch("/verify-otp", {
        method: "POST",
        body: JSON.stringify({ mail, otp }),
      });

      // store jwt & user info
      sessionStorage.setItem("token", result.token);
      sessionStorage.setItem("userId", result.userId);
      sessionStorage.setItem("name", result.name);
      sessionStorage.setItem("mail", result.mail);

      navigate("/calculator");
    } catch (error) {
      console.error(error);
      alert(error.message || "Network error while verifying OTP.");
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[url('/savings.webp')] bg-cover bg-center bg-no-repeat overflow-hidden">
      <div className="absolute bottom-4 w-full flex justify-center items-center gap-2">
    <img src="/antar-logo-removebg.png" alt="antarimage" className="h-8 w-8" />
    <p className="font-bold text-black">Powered By Antar IoT</p>
  </div>
      
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative z-10 w-full max-w-md p-8 rounded-2xl shadow-2xl bg-white/10 backdrop-blur-sm border border-white/20 text-white space-y-6">
        <div className="text-center">
          <h1 className="flex flex-col items-center justify-center text-2xl font-semibold text-sky-300 drop-shadow-lg">
            <img
              src="/antar-logo-removebg.png"
              className="h-24 w-24 mb-2"
              alt="Antar Logo"
            />
            Antar IoT Energy Saving Calculator
          </h1>
          <p className="text-gray-200 text-sm mt-2">
            Login securely using your email OTP
          </p>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <User className="absolute left-3 top-3 text-gray-300" />
            <input
              type="text"
              placeholder="Full Name"
              className="w-full bg-white/20 text-white placeholder-gray-300 border border-white/30 rounded-lg pl-10 pr-3 py-2 focus:ring-2 focus:ring-sky-400 outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="relative">
            <Mail className="absolute left-3 top-3 text-gray-300" />
            <input
              type="email"
              placeholder="Email Address"
              className="w-full bg-white/20 text-white placeholder-gray-300 border border-white/30 rounded-lg pl-10 pr-3 py-2 focus:ring-2 focus:ring-sky-400 outline-none"
              value={mail}
              onChange={(e) => setMail(e.target.value)}
            />
          </div>

          {!isOtpSent ? (
            <button
              onClick={send_otp}
              className="w-full bg-sky-500/80 hover:bg-sky-600 text-white font-semibold py-2 rounded-lg transition-all duration-300"
            >
              Send OTP
            </button>
          ) : (
            <>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-3 text-gray-300" />
                <input
                  type={showOtp ? "text" : "password"} // 👁️ toggle type
                  placeholder="Enter OTP"
                  className="w-full bg-white/20 text-white placeholder-gray-300 border border-white/30 rounded-lg pl-10 pr-10 py-2 focus:ring-2 focus:ring-green-400 outline-none"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowOtp(!showOtp)} // toggle visibility
                  className="absolute right-3 top-3 text-gray-300 hover:text-white"
                >
                  {showOtp ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              <button
                onClick={validate_otp}
                className="w-full bg-green-500/80 hover:bg-green-600 text-white font-semibold py-2 rounded-lg transition-all duration-300"
              >
                Verify OTP
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
