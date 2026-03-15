import React, { useState, useEffect, useRef } from 'react';
import { collection, query, onSnapshot, addDoc, serverTimestamp, writeBatch, doc, where, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

import { Link } from 'react-router-dom';
import { FileText, Trash2, ArrowRightLeft, X, Edit2, MessageSquare } from 'lucide-react';

export default function Students() {
  const { userData } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [name, setName] = useState('');
  const [enrollment, setEnrollment] = useState('');
  const [classId, setClassId] = useState('');
  
  const [transferStudent, setTransferStudent] = useState<any>(null);
  const [newClassId, setNewClassId] = useState('');

  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editEnrollment, setEditEnrollment] = useState('');

  const [reportStudent, setReportStudent] = useState<any>(null);
  const [reportText, setReportText] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userData?.schoolId) return;

    const qStudents = query(collection(db, 'students'), where('schoolId', '==', userData.schoolId));
    const unsubStudents = onSnapshot(qStudents, (snapshot) => {
      const studentsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      studentsList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setStudents(studentsList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching students:", error);
    });

    const qClasses = query(collection(db, 'classes'), where('schoolId', '==', userData.schoolId));
    const unsubClasses = onSnapshot(qClasses, (snapshot) => {
      const classesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      const filteredClasses = classesList.filter((c: any) => userData?.role === 'admin' || (c.teacherIds && c.teacherIds.includes(userData?.uid)));
      filteredClasses.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setClasses(filteredClasses);
    }, (error) => {
      console.error("Error fetching classes:", error);
    });

    return () => {
      unsubStudents();
      unsubClasses();
    };
  }, [userData?.schoolId]);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !classId || !userData?.schoolId) return;
    try {
      await addDoc(collection(db, 'students'), {
        name,
        enrollmentNumber: enrollment,
        classId,
        schoolId: userData.schoolId,
        createdAt: serverTimestamp(),
      });
      setName('');
      setEnrollment('');
      toast.success('Aluno adicionado com sucesso!');
    } catch (error) {
      toast.error('Erro ao adicionar aluno.');
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (!window.confirm('Tem certeza que deseja remover este aluno? Esta ação não pode ser desfeita.')) return;
    try {
      await deleteDoc(doc(db, 'students', studentId));
      toast.success('Aluno removido com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao remover aluno.');
    }
  };

  const handleTransferStudent = async () => {
    if (!transferStudent || !newClassId) return;
    try {
      await updateDoc(doc(db, 'students', transferStudent.id), {
        classId: newClassId
      });
      toast.success('Aluno transferido com sucesso!');
      setTransferStudent(null);
      setNewClassId('');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao transferir aluno.');
    }
  };

  const handleEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent || !editName.trim()) return;
    try {
      await updateDoc(doc(db, 'students', editingStudent.id), {
        name: editName,
        enrollmentNumber: editEnrollment
      });
      toast.success('Aluno atualizado com sucesso!');
      setEditingStudent(null);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar aluno.');
    }
  };

  const openEditModal = (student: any) => {
    setEditingStudent(student);
    setEditName(student.name);
    setEditEnrollment(student.enrollmentNumber || '');
  };

  const openReportModal = (student: any) => {
    setReportStudent(student);
    setReportText(student.report || '');
  };

  const handleSaveReport = async () => {
    if (!reportStudent) return;
    try {
      await updateDoc(doc(db, 'students', reportStudent.id), {
        report: reportText
      });
      toast.success('Relatório salvo com sucesso!');
      setReportStudent(null);
      setReportText('');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar relatório.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !classId || !userData?.schoolId) {
      toast.error('Selecione uma turma e um arquivo.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const batch = writeBatch(db);
        data.forEach((row: any) => {
          const newDocRef = doc(collection(db, 'students'));
          batch.set(newDocRef, {
            name: row.Nome || row.name || row.NOME,
            enrollmentNumber: row.Matricula || row.matricula || row.enrollment || '',
            classId,
            schoolId: userData.schoolId,
            createdAt: serverTimestamp(),
          });
        });

        await batch.commit();
        toast.success(`${data.length} alunos importados com sucesso!`);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (error) {
        toast.error('Erro ao processar arquivo.');
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-6">
      {userData?.role === 'admin' && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Adicionar Aluno</h3>
          
          <form onSubmit={handleAddStudent} className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do Aluno"
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
            />
            <input
              type="text"
              value={enrollment}
              onChange={(e) => setEnrollment(e.target.value)}
              placeholder="Matrícula"
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
            />
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
            >
              <option value="">Selecione a Turma</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button
              type="submit"
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Adicionar Manual
            </button>
          </form>

          <div className="mt-6 border-t border-gray-200 pt-6">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Importar em Lote (.xls, .xlsx)</h4>
            <div className="flex items-center gap-4">
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-64 sm:text-sm border-gray-300 rounded-md"
              >
                <option value="">Selecione a Turma para Importar</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input
                type="file"
                accept=".xls,.xlsx"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">O arquivo Excel deve ter colunas "Nome" e "Matricula".</p>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Lista de Alunos</h3>
        {loading ? (
          <p>Carregando...</p>
        ) : (
          <div className="space-y-8">
            {classes.map(c => {
              const classStudents = students.filter(s => s.classId === c.id);
              if (classStudents.length === 0) return null;
              
              return (
                <div key={c.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <h4 className="text-md font-semibold text-gray-800">Turma: {c.name}</h4>
                  </div>
                  <ul className="divide-y divide-gray-200">
                    {classStudents.map((student) => (
                      <li key={student.id} className="px-4 py-4 flex justify-between items-center hover:bg-gray-50">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{student.name}</p>
                          <p className="text-sm text-gray-500">Matrícula: {student.enrollmentNumber}</p>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => openReportModal(student)}
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Relatório
                          </button>
                          <Link
                            to={`/teacher/report-card/${student.id}`}
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Boletim
                          </Link>
                          {userData?.role === 'admin' && (
                            <>
                              <button
                                onClick={() => openEditModal(student)}
                                className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                              >
                                <Edit2 className="h-4 w-4 mr-1" />
                                Editar
                              </button>
                              <button
                                onClick={() => setTransferStudent(student)}
                                className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-indigo-700 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                              >
                                <ArrowRightLeft className="h-4 w-4 mr-1" />
                                Transferir
                              </button>
                              <button
                                onClick={() => handleDeleteStudent(student.id)}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent shadow-sm text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            
            {/* Alunos sem turma */}
            {userData?.role === 'admin' && students.filter(s => !s.classId || !classes.find(c => c.id === s.classId)).length > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-red-50 px-4 py-3 border-b border-red-200">
                  <h4 className="text-md font-semibold text-red-800">Alunos sem Turma</h4>
                </div>
                <ul className="divide-y divide-gray-200">
                  {students.filter(s => !s.classId || !classes.find(c => c.id === s.classId)).map((student) => (
                    <li key={student.id} className="px-4 py-4 flex justify-between items-center hover:bg-gray-50">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{student.name}</p>
                        <p className="text-sm text-gray-500">Matrícula: {student.enrollmentNumber}</p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                            onClick={() => openReportModal(student)}
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Relatório
                        </button>
                        <Link
                          to={`/teacher/report-card/${student.id}`}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          Boletim
                        </Link>
                        {userData?.role === 'admin' && (
                          <>
                            <button
                              onClick={() => openEditModal(student)}
                              className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                              <Edit2 className="h-4 w-4 mr-1" />
                              Editar
                            </button>
                            <button
                              onClick={() => setTransferStudent(student)}
                              className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-indigo-700 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                              <ArrowRightLeft className="h-4 w-4 mr-1" />
                              Transferir
                            </button>
                            <button
                              onClick={() => handleDeleteStudent(student.id)}
                              className="inline-flex items-center px-3 py-1.5 border border-transparent shadow-sm text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {transferStudent && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Transferir Aluno</h3>
              <button onClick={() => setTransferStudent(null)} className="text-gray-400 hover:text-gray-500">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Selecione a nova turma para o aluno <strong>{transferStudent.name}</strong>:
              </p>
              <select
                value={newClassId}
                onChange={(e) => setNewClassId(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                <option value="">Selecione a Turma</option>
                {classes.filter(c => c.id !== transferStudent.classId).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setTransferStudent(null)}
                className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleTransferStudent}
                disabled={!newClassId}
                className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400"
              >
                Transferir
              </button>
            </div>
          </div>
        </div>
      )}
      {editingStudent && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Editar Aluno</h3>
              <button onClick={() => setEditingStudent(null)} className="text-gray-400 hover:text-gray-500">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleEditStudent}>
              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Matrícula</label>
                  <input
                    type="text"
                    value={editEnrollment}
                    onChange={(e) => setEditEnrollment(e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!editName.trim()}
                  className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {reportStudent && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Relatório Individual - {reportStudent.name}</h3>
              <button onClick={() => setReportStudent(null)} className="text-gray-400 hover:text-gray-500">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações e Relatório</label>
                <textarea
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  rows={10}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  placeholder="Escreva aqui as observações sobre o aluno..."
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setReportStudent(null)}
                className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveReport}
                className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Salvar Relatório
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
