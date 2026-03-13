import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { School } from 'lucide-react';

export default function SetupSchool() {
  const { user, userData, refreshUserData, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [mode, setMode] = useState<'join' | 'create'>('join');
  const [inviteCode, setInviteCode] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Se o usuário já tem escola, redireciona
  if (userData?.schoolId) {
    navigate('/');
    return null;
  }

  if (!user && !authLoading) {
    navigate('/login');
    return null;
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    
    setIsSubmitting(true);
    try {
      const q = query(collection(db, 'schools'), where('inviteCode', '==', inviteCode));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        toast.error('Código de convite inválido.');
        setIsSubmitting(false);
        return;
      }

      const schoolId = querySnapshot.docs[0].id;
      
      await updateDoc(doc(db, 'users', user!.uid), {
        schoolId
      });

      await refreshUserData();
      toast.success('Você entrou na escola com sucesso!');
      navigate('/');
    } catch (error) {
      toast.error('Erro ao entrar na escola.');
      setIsSubmitting(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolName.trim()) return;
    
    setIsSubmitting(true);
    try {
      // Generate a random 6-character invite code
      const newInviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const docRef = await addDoc(collection(db, 'schools'), {
        name: schoolName,
        inviteCode: newInviteCode,
        createdAt: serverTimestamp(),
        creatorId: user!.uid
      });

      await updateDoc(doc(db, 'users', user!.uid), {
        schoolId: docRef.id,
        role: 'admin' // O criador da escola vira admin
      });

      await refreshUserData();
      toast.success('Escola criada com sucesso!');
      navigate('/');
    } catch (error) {
      toast.error('Erro ao criar escola.');
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-indigo-600 p-3 rounded-full">
            <School className="h-8 w-8 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Bem-vindo ao EduManage
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Para continuar, você precisa estar associado a uma escola.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="flex justify-center space-x-4 mb-8">
            <button
              onClick={() => setMode('join')}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                mode === 'join' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Entrar em uma Escola
            </button>
            <button
              onClick={() => setMode('create')}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                mode === 'create' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Criar Nova Escola
            </button>
          </div>

          {mode === 'join' ? (
            <form onSubmit={handleJoin} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Código de Convite</label>
                <div className="mt-1">
                  <input
                    type="text"
                    required
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Ex: AB12CD"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {isSubmitting ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleCreate} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nome da Escola</label>
                <div className="mt-1">
                  <input
                    type="text"
                    required
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Ex: Escola Municipal..."
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {isSubmitting ? 'Criando...' : 'Criar Escola'}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={logout}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Sair e usar outra conta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
