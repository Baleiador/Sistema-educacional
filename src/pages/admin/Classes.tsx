import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function Classes() {
  const { userData } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newClassName, setNewClassName] = useState('');
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);

  useEffect(() => {
    if (!userData?.schoolId) return;

    const qClasses = query(collection(db, 'classes'), where('schoolId', '==', userData.schoolId));
    const unsubClasses = onSnapshot(qClasses, (snapshot) => {
      setClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    const qTeachers = query(
      collection(db, 'users'), 
      where('role', '==', 'teacher'),
      where('schoolId', '==', userData.schoolId)
    );
    const unsubTeachers = onSnapshot(qTeachers, (snapshot) => {
      setTeachers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubClasses();
      unsubTeachers();
    };
  }, [userData?.schoolId]);

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim() || !userData?.schoolId) return;
    try {
      await addDoc(collection(db, 'classes'), {
        name: newClassName,
        schoolId: userData.schoolId,
        teacherIds: selectedTeachers,
        createdAt: serverTimestamp(),
      });
      setNewClassName('');
      setSelectedTeachers([]);
      toast.success('Turma adicionada com sucesso!');
    } catch (error) {
      toast.error('Erro ao adicionar turma.');
    }
  };

  const toggleTeacher = async (classId: string, teacherId: string, currentTeacherIds: string[] = []) => {
    const newTeacherIds = currentTeacherIds.includes(teacherId)
      ? currentTeacherIds.filter(id => id !== teacherId)
      : [...currentTeacherIds, teacherId];
    
    try {
      await updateDoc(doc(db, 'classes', classId), {
        teacherIds: newTeacherIds
      });
      toast.success('Professores atualizados!');
    } catch (error) {
      toast.error('Erro ao atualizar professores.');
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Gerenciar Turmas</h3>
      
      <form onSubmit={handleAddClass} className="mb-8 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-4">Nova Turma</h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Turma</label>
            <input
              type="text"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="Ex: 1º Ano A"
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Professores (opcional)</label>
            <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-md bg-white p-2 space-y-2">
              {teachers.map(teacher => (
                <label key={teacher.id} className="flex items-center space-x-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedTeachers.includes(teacher.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTeachers([...selectedTeachers, teacher.id]);
                      } else {
                        setSelectedTeachers(selectedTeachers.filter(id => id !== teacher.id));
                      }
                    }}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{teacher.name}</span>
                </label>
              ))}
              {teachers.length === 0 && <span className="text-gray-500 text-xs">Nenhum professor cadastrado.</span>}
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Adicionar Turma
          </button>
        </div>
      </form>

      {loading ? (
        <p>Carregando...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Turma</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Professores Atribuídos</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {classes.map((cls) => (
                <tr key={cls.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {cls.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div className="flex flex-wrap gap-2">
                      {teachers.map(teacher => {
                        const isAssigned = cls.teacherIds?.includes(teacher.id);
                        return (
                          <button
                            key={teacher.id}
                            onClick={() => toggleTeacher(cls.id, teacher.id, cls.teacherIds)}
                            className={`px-2 py-1 rounded-full text-xs font-medium border ${
                              isAssigned 
                                ? 'bg-indigo-100 text-indigo-800 border-indigo-200' 
                                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            {teacher.name}
                          </button>
                        );
                      })}
                      {teachers.length === 0 && <span>-</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
