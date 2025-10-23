import React, { useState, useEffect } from "react";
import { PlusCircle, Zap, Trash2 } from "lucide-react";
import { apiFetch } from "../api";

const Calculator = () => {
  const [appliances, setAppliances] = useState([]);
  const [form, setForm] = useState({
    applianceName: "",
    rating: "",
    hourlyUsage: "",
    quantity: "",
    dayFrequency: "",
  });

  // Fetch appliances on mount
  useEffect(() => {
    fetchAppliances();
  }, []);

  const fetchAppliances = async () => {
    try {
      const data = await apiFetch("/appliances", { method: "GET" });
      setAppliances(data);
    } catch (error) {
      console.error(error);
      alert(error.message || "Error fetching appliances.");
    }
  };

  const addAppliance = async () => {
    // Basic validation
    if (Object.values(form).some((f) => f === "" || f === null)) return alert("Please fill all fields!");

    const payload = {
      applianceName: form.applianceName.trim(),
      rating: parseFloat(form.rating),
      hourlyUsage: parseFloat(form.hourlyUsage),
      quantity: parseInt(form.quantity),
      dayFrequency: parseInt(form.dayFrequency),
    };

    try {
      await apiFetch("/appliances", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setForm({ applianceName: "", rating: "", hourlyUsage: "", quantity: "", dayFrequency: "" });
      fetchAppliances();
    } catch (error) {
      console.error("Add failed:", error);
      alert(error.message || "Failed to add appliance.");
    }
  };

  const deleteAppliance = async (applianceId) => {
    if (!window.confirm("Are you sure you want to delete this appliance?")) return;
    try {
      await apiFetch(`/appliances/${applianceId}`, {
        method: "DELETE",
      });
      fetchAppliances();
    } catch (error) {
      console.error("Error deleting appliance:", error);
      alert(error.message || "Failed to delete appliance.");
    }
  };

  const handleLogout = () => {
    sessionStorage.clear();
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <header className="mb-8 flex flex-col items-center text-center w-full">
        {/* Centered image */}
        <img
          src="/antar-iot-calculator.jpg"
          alt="Antar IoT Logo"
          className="w-32 h-32 object-contain mb-4"
        />

        {/* Title */}
        <div className="flex justify-between w-full">
          <h1 className="text-3xl font-bold text-sky-700 flex items-center justify-center gap-2 mb-4">
          <Zap className="text-yellow-500" /> Energy Calculator
        </h1>

        {/* Logout button */}
        <button
          onClick={handleLogout}
          className="px-5 py-2 border border-red-500 text-red-600 font-medium rounded-md bg-transparent hover:bg-red-600 hover:text-white transition-all duration-300"
        >
          Logout
        </button>
        </div>
        
      </header>


      <div className="bg-white shadow-md rounded-xl p-6 mb-8 grid grid-cols-1 md:grid-cols-5 gap-4">
        {["applianceName", "rating", "hourlyUsage", "quantity", "dayFrequency"].map(
          (key, i) => (
            <input
              key={i}
              type={key === "applianceName" ? "text" : "number"}
              placeholder={key.replace(/([A-Z])/g, " $1")}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-400 outline-none"
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          )
        )}
        <button
          onClick={addAppliance}
          className="col-span-full bg-sky-600 text-white py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-sky-700 transition-all duration-300"
        >
          <PlusCircle /> Add Appliance
        </button>
      </div>

      <div className="bg-white shadow-md rounded-xl p-6 overflow-x-auto">
        <table className="min-w-full text-left border-collapse">
          <thead className="bg-sky-600 text-white">
            <tr>
              <th className="p-3">Appliance</th>
              <th className="p-3">Monthly Consumption (kWh)</th>
              <th className="p-3">Monthly Cost</th>
              <th className="p-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {appliances.map((a) => (
              <tr key={a._id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium">{a.applianceName}</td>
                <td className="p-3">{a.consumptionPerMonth.toFixed(2)}</td>
                <td className="p-3">${a.monthlyCost.toFixed(2)}</td>
                <td className="p-3 text-center">
                  <button
                    onClick={() => deleteAppliance(a._id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
            {appliances.length === 0 && (
              <tr>
                <td colSpan="4" className="text-center py-6 text-gray-500">
                  No appliances added yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Calculator;
