import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Trash2, Plus } from 'lucide-react';

export default function Subjects() {
  const { userData } = useAuth();
  const [subjects, setSubjects] = useState<string[]>([]);
  const [newSubject, setNewSubject] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userData?.schoolId) {
      getDoc(doc(db, 'schools', userData.schoolId)).then(docSnap => {
        if (docSnap.exists()) {
          setSubjects(docSnap.data().subjects || []);
        }
        setLoading(false);
      });
    }
  }, [userData?.schoolId]);

  const handleAddSubject = async () => {
    if (!newSubject.trim() || !userData?.schoolId) return;
    
    const subjectName = newSubject.trim();
    if (subjects.includes(subjectName)) {
      toast.error('Esta disciplina já existe.');
      return;
    }

    const updatedSubjects = [...subjects, subjectName];
    
    try {
      await updateDoc(doc(db, 'schools', userData.schoolId), {
        subjects: updatedSubjects
      });
      setSubjects(updatedSubjects);
      setNewSubject('');
      toast.success('Disciplina adicionada com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao adicionar disciplina.');
    }
  };

  const handleRemoveSubject = async (subjectToRemove: string) => {
    if (!userData?.schoolId) return;
    
    const updatedSubjects = subjects.filter(s => s !== subjectToRemove);
    
    try {
      await updateDoc(doc(db, 'schools', userData.schoolId), {
        subjects: updatedSubjects
      });
      setSubjects(updatedSubjects);
      toast.success('Disciplina removida com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao remover disciplina.');
    }
  };

  if (loading) return <div className="p-6">Carregando...</div>;

  return (
    <div className="bg-white shadow rounded-lg p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Disciplinas da Escola</h2>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Adicionar Nova Disciplina
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddSubject()}
            placeholder="Ex: Matemática, Português, História..."
            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
          />
          <button
            onClick={handleAddSubject}
            disabled={!newSubject.trim()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Disciplinas Cadastradas</h3>
        {subjects.length === 0 ? (
          <p className="text-gray-500 italic">Nenhuma disciplina cadastrada na escola ainda.</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
            <ul className="divide-y divide-gray-200">
              {subjects.map((subject) => (
                <li key={subject} className="px-4 py-4 flex items-center justify-between hover:bg-gray-50">
                  <span className="text-sm font-medium text-gray-900">{subject}</span>
                  <button
                    onClick={() => handleRemoveSubject(subject)}
                    className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50"
                    title="Remover disciplina"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
