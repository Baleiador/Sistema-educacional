/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Teachers from './pages/admin/Teachers';
import Classes from './pages/admin/Classes';
import Students from './pages/admin/Students';
import Attendance from './pages/teacher/Attendance';
import Lessons from './pages/teacher/Lessons';
import Grades from './pages/teacher/Grades';
import ReportCard from './pages/teacher/ReportCard';
import ClassReportCards from './pages/teacher/ClassReportCards';
import Settings from './pages/admin/Settings';
import AttendanceHistory from './pages/admin/AttendanceHistory';
import Documents from './pages/admin/Documents';

import SetupSchool from './pages/SetupSchool';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/setup-school" element={<SetupSchool />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="profile" element={<Profile />} />
            <Route path="admin/teachers" element={<Teachers />} />
            <Route path="admin/classes" element={<Classes />} />
            <Route path="admin/students" element={<Students />} />
            <Route path="admin/attendance-history" element={<AttendanceHistory />} />
            <Route path="admin/documents" element={<Documents />} />
            <Route path="admin/settings" element={<Settings />} />
            <Route path="teacher/attendance" element={<Attendance />} />
            <Route path="teacher/lessons" element={<Lessons />} />
            <Route path="teacher/grades" element={<Grades />} />
            <Route path="teacher/report-card/:studentId" element={<ReportCard />} />
            <Route path="teacher/report-cards/class/:classId" element={<ClassReportCards />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
