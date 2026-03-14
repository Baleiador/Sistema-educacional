import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { AVAILABLE_SUBJECTS } from '../../utils/subjects';
import { X } from 'lucide-react';

export default function Teachers() {
  const { userData } = useAuth();
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSubjects, setEditingSubjects] = useState<string | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  useEffect(() => {
    if (!userData?.schoolId) return;
    
    // Fetch all users in the school (teachers and admins)
    const q = query(
      collection(db, 'users'), 
      where('schoolId', '==', userData.schoolId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [userData?.schoolId]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (userId === userData?.uid) {
      toast.error('Você não pode alterar seu próprio cargo.');
      return;
    }
    
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole
      });
      toast.success('Cargo atualizado com sucesso!');
    } catch (error) {
      toast.error('Erro ao atualizar cargo.');
    }
  };

  const openSubjectsModal = (member: any) => {
    setEditingSubjects(member.id);
    setSelectedSubjects(member.subjects || []);
  };

  const toggleSubject = (subject: string) => {
    setSelectedSubjects(prev => 
      prev.includes(subject) ? prev.filter(s => s !== subject) : [...prev, subject]
    );
  };

  const saveSubjects = async () => {
    if (!editingSubjects) return;
    try {
      await updateDoc(doc(db, 'users', editingSubjects), {
        subjects: selectedSubjects
      });
      toast.success('Disciplinas atualizadas!');
      setEditingSubjects(null);
    } catch (error) {
      toast.error('Erro ao atualizar disciplinas.');
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Equipe (Professores e Direção)</h3>
      {loading ? (
        <p>Carregando...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cargo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Disciplinas</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {staff.map((member) => (
                <tr key={member.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{member.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{member.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.id, e.target.value)}
                      disabled={member.id === userData?.uid}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md disabled:bg-gray-100"
                    >
                      <option value="teacher">Professor</option>
                      <option value="admin">Administrador (Direção/Coordenação)</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {member.role === 'teacher' ? (
                      <div className="flex items-center justify-between">
                        <span className="truncate max-w-[200px]" title={member.subjects?.join(', ')}>
                          {member.subjects?.length > 0 ? member.subjects.join(', ') : 'Nenhuma'}
                        </span>
                        <button
                          onClick={() => openSubjectsModal(member)}
                          className="ml-2 text-indigo-600 hover:text-indigo-900 font-medium"
                        >
                          Editar
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingSubjects && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Selecionar Disciplinas</h3>
              <button onClick={() => setEditingSubjects(null)} className="text-gray-400 hover:text-gray-500">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto mb-4 border border-gray-200 rounded-md p-2">
              {AVAILABLE_SUBJECTS.map(subject => (
                <label key={subject} className="flex items-center p-2 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedSubjects.includes(subject)}
                    onChange={() => toggleSubject(subject)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <span className="ml-3 text-sm text-gray-700">{subject}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setEditingSubjects(null)}
                className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={saveSubjects}
                className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
