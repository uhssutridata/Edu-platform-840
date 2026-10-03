import { Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Homework from "@/pages/Homework";
import Exams from "@/pages/Exams";
import ExamRoom from "@/pages/ExamRoom";
import Tutorials from "@/pages/Tutorials";
import Chat from "@/pages/Chat";
import AdminRadar from "@/pages/AdminRadar";
import Subscription from "@/pages/Subscription";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/homework" element={<Homework />} />
        <Route path="/exams" element={<Exams />} />
        <Route path="/exams/:examId" element={<ExamRoom />} />
        <Route path="/tutorials" element={<Tutorials />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/admin" element={<AdminRadar />} />
        <Route path="/subscription" element={<Subscription />} />
        <Route path="*" element={<Home />} />
      </Routes>
      <Toaster richColors />
    </>
  );
}
