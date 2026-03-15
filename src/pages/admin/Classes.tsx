import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { AVAILABLE_SUBJECTS } from '../../utils/subjects';
import { X, Trash2 } from 'lucide-react';

export default function Classes() {
  const { userData } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newClassName, setNewClassName] = useState('');
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [editingSubjects, setEditingSubjects] = useState<string | null>(null);
  const [editSubjectsList, setEditSubjectsList] = useState<string[]>([]);
  const [schoolSubjects, setSchoolSubjects] = useState<string[]>([]);

  useEffect(() => {
    if (!userData?.schoolId) return;

    // Fetch school to get subjects
    import('firebase/firestore').then(({ getDoc }) => {
      getDoc(doc(db, 'schools', userData.schoolId as string)).then(docSnap => {
        if (docSnap.exists()) {
          setSchoolSubjects(docSnap.data().subjects || AVAILABLE_SUBJECTS);
        }
      });
    });

    const qClasses = query(collection(db, 'classes'), where('schoolId', '==', userData.schoolId));
    const unsubClasses = onSnapshot(qClasses, (snapshot) => {
      const classesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      classesList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setClasses(classesList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching classes:", error);
    });

    const qTeachers = query(
      collection(db, 'users'), 
      where('role', '==', 'teacher'),
      where('schoolId', '==', userData.schoolId)
    );
    const unsubTeachers = onSnapshot(qTeachers, (snapshot) => {
      const teachersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      teachersList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setTeachers(teachersList);
    }, (error) => {
      console.error("Error fetching teachers:", error);
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
        subjects: selectedSubjects,
        createdAt: serverTimestamp(),
      });
      setNewClassName('');
      setSelectedTeachers([]);
      setSelectedSubjects([]);
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

  const openSubjectsModal = (cls: any) => {
    setEditingSubjects(cls.id);
    setEditSubjectsList(cls.subjects || []);
  };

  const toggleEditSubject = (subject: string) => {
    setEditSubjectsList(prev => 
      prev.includes(subject) ? prev.filter(s => s !== subject) : [...prev, subject]
    );
  };

  const saveSubjects = async () => {
    if (!editingSubjects) return;
    try {
      await updateDoc(doc(db, 'classes', editingSubjects), {
        subjects: editSubjectsList
      });
      toast.success('Disciplinas da turma atualizadas!');
      setEditingSubjects(null);
    } catch (error) {
      toast.error('Erro ao atualizar disciplinas.');
    }
  };

  const deleteClass = async (classId: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta turma?')) {
      try {
        await deleteDoc(doc(db, 'classes', classId));
        toast.success('Turma excluída com sucesso!');
      } catch (error) {
        toast.error('Erro ao excluir turma.');
      }
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Gerenciar Turmas</h3>
      
      <form onSubmit={handleAddClass} className="mb-8 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-4">Nova Turma</h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Disciplinas (opcional)</label>
            <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-md bg-white p-2 space-y-2">
              {schoolSubjects.map(subject => (
                <label key={subject} className="flex items-center space-x-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedSubjects.includes(subject)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSubjects([...selectedSubjects, subject]);
                      } else {
                        setSelectedSubjects(selectedSubjects.filter(s => s !== subject));
                      }
                    }}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{subject}</span>
                </label>
              ))}
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Disciplinas</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
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
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div className="flex flex-wrap gap-1 mb-2">
                      {cls.subjects?.map((subject: string) => (
                        <span key={subject} className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                          {subject}
                        </span>
                      ))}
                      {(!cls.subjects || cls.subjects.length === 0) && <span className="text-gray-400 italic">Nenhuma disciplina</span>}
                    </div>
                    <button
                      onClick={() => openSubjectsModal(cls)}
                      className="text-indigo-600 hover:text-indigo-900 text-xs font-medium"
                    >
                      Editar Disciplinas
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => deleteClass(cls.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Excluir Turma"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Subjects Modal */}
      {editingSubjects && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Disciplinas da Turma</h3>
              <button onClick={() => setEditingSubjects(null)} className="text-gray-400 hover:text-gray-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md p-3 space-y-2 mb-4">
              {schoolSubjects.map(subject => (
                <label key={subject} className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={editSubjectsList.includes(subject)}
                    onChange={() => toggleEditSubject(subject)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <span className="text-sm text-gray-700">{subject}</span>
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
