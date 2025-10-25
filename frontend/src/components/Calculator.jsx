import React, { useState, useEffect } from "react";
import { PlusCircle, Zap, Trash2, Info } from "lucide-react";
import { apiFetch } from "../api";

const Calculator = () => {
  const [appliances, setAppliances] = useState([]);
  const [form, setForm] = useState({
    applianceName: "",
    rating: "", // in watts
    hourlyUsage: "",
    quantity: "",
    dayFrequency: "",
    unitRate: "", // new field
  });
  const [showTooltip, setShowTooltip] = useState(false);

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
    if (Object.values(form).some((f) => f === "" || f === null))
      return alert("Please fill all fields!");

    // Convert watts → kilowatts
    const ratingKW = parseFloat(form.rating) / 1000;

    const payload = {
      applianceName: form.applianceName.trim(),
      rating: ratingKW,
      hourlyUsage: parseFloat(form.hourlyUsage),
      quantity: parseInt(form.quantity),
      dayFrequency: parseInt(form.dayFrequency),
      unitRate: parseFloat(form.unitRate), // include unit rate
    };

    try {
      await apiFetch("/appliances", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setForm({
        applianceName: "",
        rating: "",
        hourlyUsage: "",
        quantity: "",
        dayFrequency: "",
        unitRate: "",
      });
      fetchAppliances();
    } catch (error) {
      console.error("Add failed:", error);
      alert(error.message || "Failed to add appliance.");
    }
  };

  const deleteAppliance = async (applianceId) => {
    if (!window.confirm("Are you sure you want to delete this appliance?"))
      return;
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

  const tooltips = {
    applianceName: "Enter the name of the appliance (e.g., Fan, TV, Fridge)",
    rating: "Enter the power rating in watts (max 5000 W = 5 kW)",
    hourlyUsage: "Enter how many hours per day the appliance is used (max 24)",
    quantity: "Enter the number of identical appliances",
    dayFrequency: "Enter how many days per week the appliance is used (max 7)",
    unitRate: "Enter the electricity unit rate in ₹/kWh",
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[url('/calculator-bg-image.jpeg')] bg-cover bg-center bg-no-repeat relative">
      <div className="absolute bottom-4 w-full flex justify-center items-center gap-2">
        <img src="/antar-logo-removebg.png" alt="antarimage" className="h-8 w-8" />
        <p className="font-bold text-white">Powered By Antar IoT</p>
      </div>

      <div className="absolute inset-0 bg-black/40" />

      <div className="relative z-10 w-full max-w-6xl mx-auto p-8 rounded-2xl shadow-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white space-y-8">
        <header className="mb-4 flex flex-col items-center text-center w-full">
          <img
            src="/antar-iot-calculator-removebg-preview.png"
            alt="Antar IoT Logo"
            className="w-48 h-48 object-contain drop-shadow-lg invert"
          />
          <div className="flex justify-between items-center w-full relative">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-sky-300 flex items-center gap-2 drop-shadow-lg">
                <Zap className="text-yellow-400" /> Energy Calculator
              </h1>

              <div
                className="relative cursor-pointer"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
              >
                <Info className="text-gray-300 hover:text-white" size={20} />
                {showTooltip && (
                  <div className="absolute left-6 top-1 bg-white text-black text-xs font-medium px-3 py-1.5 rounded-md shadow-md whitespace-nowrap">
                    All fields are mandatory
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="px-5 py-2 border border-red-500 bg-red-600 font-medium rounded-md hover:bg-red-500 text-white transition-all duration-300"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Form Section */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/20 shadow-lg rounded-xl p-6 mb-8 grid grid-cols-1 md:grid-cols-6 gap-4">
          {[
            { key: "applianceName", label: "Appliance Name" },
            { key: "rating", label: "Rating (W)" },
            { key: "hourlyUsage", label: "Hourly Usage (hrs)" },
            { key: "quantity", label: "Quantity" },
            { key: "dayFrequency", label: "Days Used / Week" },
            { key: "unitRate", label: "Unit Rate (₹)" }, // new input
          ].map(({ key, label }, i) => (
            <div key={i} className="flex flex-col">
              <label
                htmlFor={key}
                className="text-sm font-semibold mb-1 text-gray-200"
              >
                {label} <span className="text-red-400">*</span>
              </label>

              <input
                id={key}
                type={key === "applianceName" ? "text" : "number"}
                placeholder={label}
                title={tooltips[key]}
                className="border border-white/30 bg-white/20 text-white placeholder-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-400 outline-none"
                value={form[key]}
                onChange={(e) => {
                  let value = e.target.value;
                  if (key === "rating" && value > 5000) value = 5000;
                  if (key === "hourlyUsage" && value > 24) value = 24;
                  if (key === "dayFrequency" && value > 7) value = 7;
                  setForm({ ...form, [key]: value });
                }}
                min={0}
                max={
                  key === "rating"
                    ? 5000
                    : key === "hourlyUsage"
                    ? 24
                    : key === "dayFrequency"
                    ? 7
                    : undefined
                }
              />
            </div>
          ))}

          <button
            onClick={addAppliance}
            className="col-span-full bg-sky-500/80 hover:bg-sky-600 text-white py-2 text-sm rounded-lg items-center justify-center gap-2 transition-all duration-300 flex"
          >
            <PlusCircle size={16} /> Add Appliance
          </button>
        </div>

        {/* Table Section */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 shadow-lg p-6 overflow-x-auto rounded-xl">
          <table className="min-w-full text-left border-collapse rounded-md">
            <thead className="bg-sky-600/80 text-white rounded-md">
              <tr>
                <th className="p-3">Appliance</th>
                <th className="p-3">Consumption / Day (kWh)</th>
                <th className="p-3">Consumption / Week (kWh)</th>
                <th className="p-3">Monthly Consumption (kWh)</th>
                <th className="p-3">Monthly Cost</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {appliances.map((a) => {
                const dailyConsumption = a.rating * a.hourlyUsage * a.quantity;
                const weeklyConsumption = dailyConsumption * a.dayFrequency;
                const monthlyCost = (a.unitRate || 0) * a.consumptionPerMonth; // calculate cost
                return (
                  <tr
                    key={a._id}
                    className="border-b border-white/20 hover:bg-white/10"
                  >
                    <td className="p-3 font-medium">{a.applianceName}</td>
                    <td className="p-3">{dailyConsumption.toFixed(2)}</td>
                    <td className="p-3">{weeklyConsumption.toFixed(2)}</td>
                    <td className="p-3">{a.consumptionPerMonth.toFixed(2)}</td>
                    <td className="p-3">₹{monthlyCost.toFixed(2)}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => deleteAppliance(a._id)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {appliances.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center py-6 text-gray-300">
                    No appliances added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Calculator;
