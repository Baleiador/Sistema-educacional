import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft } from 'lucide-react';

export default function ClassReportCards() {
  const { classId } = useParams<{ classId: string }>();
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<any[]>([]);
  const [school, setSchool] = useState<any>(null);
  const [className, setClassName] = useState('');
  const [grades, setGrades] = useState<Record<string, Record<string, Record<number, any>>>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!classId || !userData?.schoolId) return;

      try {
        // Fetch school
        const schoolDoc = await getDoc(doc(db, 'schools', userData.schoolId));
        if (schoolDoc.exists()) setSchool(schoolDoc.data());

        // Fetch class
        const classDoc = await getDoc(doc(db, 'classes', classId));
        if (classDoc.exists()) setClassName(classDoc.data().name);

        // Fetch students
        const qStudents = query(collection(db, 'students'), where('classId', '==', classId));
        const studentsSnap = await getDocs(qStudents);
        const studentsList = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        // Sort students alphabetically
        studentsList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setStudents(studentsList);

        // Fetch grades
        const qGrades = query(
          collection(db, 'grades'),
          where('classId', '==', classId),
          where('schoolId', '==', userData.schoolId)
        );
        const gradesSnap = await getDocs(qGrades);
        const gradesMap: Record<string, Record<string, Record<number, any>>> = {};
        gradesSnap.docs.forEach(d => {
          const data = d.data();
          const subject = data.subject || 'Geral';
          if (!gradesMap[data.studentId]) gradesMap[data.studentId] = {};
          if (!gradesMap[data.studentId][subject]) gradesMap[data.studentId][subject] = {};
          gradesMap[data.studentId][subject][data.bimester] = data;
        });
        setGrades(gradesMap);

      } catch (error) {
        console.error("Error fetching class report cards:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [classId, userData?.schoolId]);

  if (loading) return <div className="p-6">Carregando boletins...</div>;
  if (students.length === 0) return <div className="p-6">Nenhum aluno encontrado nesta turma.</div>;

  const bimesters = [1, 2, 3, 4];

  return (
    <div className="bg-white shadow rounded-lg p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6 print:hidden">
        <button onClick={() => navigate(-1)} className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500">
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </button>
        <button onClick={() => window.print()} className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
          <Printer className="h-4 w-4 mr-2" /> Imprimir Todos os Boletins
        </button>
      </div>

      <div className="print:p-0">
        {students.map((student, index) => {
          const studentGrades = grades[student.id] || {};
          const subjects = Object.keys(studentGrades).sort();
          
          return (
            <div key={student.id} className={index < students.length - 1 ? "break-after-page mb-16 print:mb-0" : ""}>
              <div className="text-center mb-8 border-b-2 border-gray-800 pb-6">
                {school?.logo && <img src={school.logo} alt="Logo da Escola" className="h-24 w-auto mx-auto mb-4 object-contain" />}
                <h1 className="text-3xl font-bold text-gray-900 uppercase tracking-wider">{school?.name || 'Escola'}</h1>
                <h2 className="text-xl font-semibold text-gray-700 mt-2">Boletim Escolar - {className}</h2>
              </div>

              <div className="mb-8 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p><span className="font-bold text-gray-700">Aluno:</span> {student.name}</p>
                  <p><span className="font-bold text-gray-700">Matrícula:</span> {student.id.substring(0, 8).toUpperCase()}</p>
                </div>
                <div className="text-right">
                  <p><span className="font-bold text-gray-700">Ano Letivo:</span> {new Date().getFullYear()}</p>
                </div>
              </div>

              {subjects.length === 0 ? (
                <p className="text-center text-gray-500 py-4">Nenhuma nota lançada para este aluno.</p>
              ) : (
                subjects.map(subject => (
                  <div key={subject} className="mb-8">
                    <h3 className="text-lg font-bold text-gray-800 mb-2 border-b border-gray-300 pb-1">{subject}</h3>
                    <table className="min-w-full border-collapse border border-gray-400">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="border border-gray-400 px-4 py-2 text-center font-bold text-gray-700">Bimestre</th>
                          <th className="border border-gray-400 px-4 py-2 text-center font-bold text-gray-700">Nota 1</th>
                          <th className="border border-gray-400 px-4 py-2 text-center font-bold text-gray-700">Nota 2</th>
                          <th className="border border-gray-400 px-4 py-2 text-center font-bold text-gray-700">Nota 3</th>
                          <th className="border border-gray-400 px-4 py-2 text-center font-bold text-gray-700">Recuperação</th>
                          <th className="border border-gray-400 px-4 py-2 text-center font-bold text-gray-700">Média Final</th>
                          <th className="border border-gray-400 px-4 py-2 text-center font-bold text-gray-700">Situação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bimesters.map(b => {
                          const g = studentGrades[subject][b] || {};
                          const avg = g.average !== undefined && g.average !== null ? g.average : '-';
                          const isApproved = avg !== '-' && avg >= 7;
                          const isFailed = avg !== '-' && avg < 7;
                          
                          return (
                            <tr key={b}>
                              <td className="border border-gray-400 px-4 py-3 text-center font-medium">{b}º Bimestre</td>
                              <td className="border border-gray-400 px-4 py-3 text-center">{g.n1 !== undefined ? g.n1 : '-'}</td>
                              <td className="border border-gray-400 px-4 py-3 text-center">{g.n2 !== undefined ? g.n2 : '-'}</td>
                              <td className="border border-gray-400 px-4 py-3 text-center">{g.n3 !== undefined ? g.n3 : '-'}</td>
                              <td className="border border-gray-400 px-4 py-3 text-center text-amber-600 font-medium">{g.recovery !== undefined ? g.recovery : '-'}</td>
                              <td className="border border-gray-400 px-4 py-3 text-center font-bold">{avg}</td>
                              <td className={`border border-gray-400 px-4 py-3 text-center font-bold ${isApproved ? 'text-green-600' : isFailed ? 'text-red-600' : 'text-gray-500'}`}>
                                {avg !== '-' ? (isApproved ? 'Aprovado' : 'Reprovado') : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))
              )}

              <div className="mt-16 flex justify-between px-12 print:px-0">
                <div className="text-center w-64">
                  <div className="border-t border-gray-800 pt-2">
                    <p className="text-sm font-bold text-gray-700">Assinatura do Diretor</p>
                  </div>
                </div>
                <div className="text-center w-64">
                  <div className="border-t border-gray-800 pt-2">
                    <p className="text-sm font-bold text-gray-700">Assinatura do Responsável</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
