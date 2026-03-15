import React, { useState } from 'react';
import { Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  GraduationCap, 
  BookOpen, 
  CheckSquare, 
  LogOut, 
  UserCircle,
  FileText,
  Settings,
  Menu,
  X,
  FolderOpen
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Layout() {
  const { user, userData, loading, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading || (user && !userData)) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">Carregando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!userData?.schoolId) {
    return <Navigate to="/setup-school" replace />;
  }

  const adminLinks = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Equipe', href: '/admin/teachers', icon: Users },
    { name: 'Turmas', href: '/admin/classes', icon: BookOpen },
    { name: 'Alunos', href: '/admin/students', icon: GraduationCap },
    { name: 'Histórico de Chamadas', href: '/admin/attendance-history', icon: CheckSquare },
    { name: 'Documentos', href: '/admin/documents', icon: FolderOpen },
    { name: 'Notas', href: '/teacher/grades', icon: FileText },
    { name: 'Configurações', href: '/admin/settings', icon: Settings },
  ];

  const teacherLinks = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Alunos', href: '/admin/students', icon: GraduationCap },
    { name: 'Chamada', href: '/teacher/attendance', icon: CheckSquare },
    { name: 'Conteúdo de Aula', href: '/teacher/lessons', icon: BookOpen },
    { name: 'Documentos', href: '/admin/documents', icon: FolderOpen },
    { name: 'Notas', href: '/teacher/grades', icon: FileText },
  ];

  const links = userData.role === 'admin' ? adminLinks : teacherLinks;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-indigo-600">EduManage</h1>
          <button 
            className="md:hidden text-gray-500 hover:text-gray-700"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.href;
            return (
              <Link
                key={link.name}
                to={link.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  isActive
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  'group flex items-center px-2 py-2 text-sm font-medium rounded-md'
                )}
              >
                <Icon
                  className={cn(
                    isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-500',
                    'mr-3 flex-shrink-0 h-5 w-5'
                  )}
                  aria-hidden="true"
                />
                {link.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-200">
          <Link
            to="/profile"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center px-2 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900"
          >
            <UserCircle className="mr-3 h-5 w-5 text-gray-400" />
            Meu Perfil
          </Link>
          <button
            onClick={logout}
            className="w-full flex items-center px-2 py-2 mt-1 text-sm font-medium text-red-600 rounded-md hover:bg-red-50"
          >
            <LogOut className="mr-3 h-5 w-5 text-red-500" />
            Sair
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white shadow-sm h-16 flex items-center justify-between px-4 sm:px-8">
          <div className="flex items-center">
            <button
              className="mr-4 md:hidden text-gray-500 hover:text-gray-700"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
            <h2 className="text-lg font-medium text-gray-900 capitalize truncate">
              {location.pathname === '/' ? 'Dashboard' : location.pathname.split('/').pop()?.replace('-', ' ')}
            </h2>
          </div>
          <div className="flex items-center ml-4">
            <span className="text-sm text-gray-500 mr-2 sm:mr-4 hidden sm:inline-block truncate max-w-[150px]">Olá, {userData.name}</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 capitalize">
              {userData.role}
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
