import React, { useState, useEffect, useRef } from 'react';
import { collection, query, onSnapshot, addDoc, serverTimestamp, writeBatch, doc, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';

export default function Students() {
  const { userData } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [name, setName] = useState('');
  const [enrollment, setEnrollment] = useState('');
  const [classId, setClassId] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userData?.schoolId) return;

    const qStudents = query(collection(db, 'students'), where('schoolId', '==', userData.schoolId));
    const unsubStudents = onSnapshot(qStudents, (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    const qClasses = query(collection(db, 'classes'), where('schoolId', '==', userData.schoolId));
    const unsubClasses = onSnapshot(qClasses, (snapshot) => {
      setClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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

      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Lista de Alunos</h3>
        {loading ? (
          <p>Carregando...</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {students.map((student) => {
              const studentClass = classes.find(c => c.id === student.classId);
              return (
                <li key={student.id} className="py-4 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{student.name}</p>
                    <p className="text-sm text-gray-500">Matrícula: {student.enrollmentNumber}</p>
                    <p className="text-sm text-gray-500">Turma: {studentClass?.name || 'Sem turma'}</p>
                  </div>
                  <div className="flex space-x-2">
                    <Link
                      to={`/teacher/report-card/${student.id}`}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      Boletim
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
