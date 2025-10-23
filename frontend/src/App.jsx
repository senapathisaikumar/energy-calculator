import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./components/Home";
import Calculator from "./components/Calculator";

const ProtectedRoute = ({ children }) => {
  const token = sessionStorage.getItem("token");
  if (!token) return <Navigate to="/" replace />;
  return children;
};

function App() {
  return ( 
    <Routes>
      <Route path="/" element={<Home />} />
      <Route
        path="/calculator"
        element={
          <ProtectedRoute>
            <Calculator />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
