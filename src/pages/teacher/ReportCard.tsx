import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft } from 'lucide-react';

export default function ReportCard() {
  const { studentId } = useParams<{ studentId: string }>();
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [student, setStudent] = useState<any>(null);
  const [school, setSchool] = useState<any>(null);
  const [classData, setClassData] = useState<any>(null);
  const [grades, setGrades] = useState<Record<string, Record<number | string, any>>>({});
  const [loading, setLoading] = useState(true);
  const [selectedBimester, setSelectedBimester] = useState<number | 'annual'>(1);

  useEffect(() => {
    const fetchReportCard = async () => {
      if (!studentId || !userData?.schoolId) return;

      try {
        // Fetch student
        const studentDoc = await getDoc(doc(db, 'students', studentId));
        if (!studentDoc.exists()) {
          setLoading(false);
          return;
        }
        const studentData = studentDoc.data();
        setStudent({ id: studentDoc.id, ...studentData });

        // Fetch class
        if (studentData.classId) {
          const classDoc = await getDoc(doc(db, 'classes', studentData.classId));
          if (classDoc.exists()) setClassData(classDoc.data());
        }

        // Fetch school
        const schoolDoc = await getDoc(doc(db, 'schools', userData.schoolId));
        if (schoolDoc.exists()) {
          setSchool(schoolDoc.data());
        }

        // Fetch grades
        const qGrades = query(
          collection(db, 'grades'),
          where('studentId', '==', studentId),
          where('schoolId', '==', userData.schoolId)
        );
        const gradesSnap = await getDocs(qGrades);
        const gradesMap: Record<string, Record<number | string, any>> = {};
        gradesSnap.docs.forEach(d => {
          const data = d.data();
          const subject = data.subject || 'Geral';
          if (!gradesMap[subject]) gradesMap[subject] = {};
          gradesMap[subject][data.bimester] = data;
        });
        setGrades(gradesMap);

      } catch (error) {
        console.error("Error fetching report card:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReportCard();
  }, [studentId, userData?.schoolId]);

  if (loading) return <div className="p-6">Carregando boletim...</div>;
  if (!student) return <div className="p-6">Aluno não encontrado.</div>;

  const gradingSystem = school?.gradingSystem || { numberOfGrades: 3, weights: [1, 1, 1] };
  const numberOfGrades = gradingSystem.numberOfGrades;
  const classSubjects = classData?.subjects || [];
  const subjectsToDisplay = classSubjects.length > 0 ? classSubjects : Object.keys(grades).sort();

  return (
    <div className="bg-white shadow rounded-lg p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6 print:hidden">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </button>
          <select
            value={selectedBimester}
            onChange={(e) => setSelectedBimester(e.target.value === 'annual' ? 'annual' : Number(e.target.value))}
            className="block w-48 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            <option value={1}>1º Bimestre</option>
            <option value={2}>2º Bimestre</option>
            <option value={3}>3º Bimestre</option>
            <option value={4}>4º Bimestre</option>
            <option value="annual">Resultado Anual</option>
          </select>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <Printer className="h-4 w-4 mr-2" />
          Imprimir Boletim
        </button>
      </div>

      {/* Printable Area */}
      <div className="print:p-8">
        <div className="mb-8 border-b-2 border-gray-800 pb-6 flex justify-between items-start">
          <div className="flex items-center text-left text-sm text-gray-600">
            {school?.logo && (
              <img src={school.logo} alt="Logo da Escola" className="h-16 w-auto mr-4 object-contain" />
            )}
            <div>
              {school?.address && <p>{school.address}</p>}
              {school?.cnpj && <p>CNPJ: {school.cnpj}</p>}
              {school?.responsible && <p>Resp: {school.responsible}</p>}
            </div>
          </div>
          <div className="text-right flex-1 ml-4">
            <h1 className="text-3xl font-bold text-gray-900 uppercase tracking-wider">{school?.name || 'Escola'}</h1>
            <h2 className="text-xl font-semibold text-gray-700 mt-2">Boletim Escolar {classData?.name ? `- ${classData.name}` : ''}</h2>
            <h3 className="text-lg font-medium text-gray-600 mt-1">
              {selectedBimester === 'annual' ? 'Resultado Anual' : `${selectedBimester}º Bimestre`}
            </h3>
          </div>
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

        {subjectsToDisplay.length === 0 ? (
          <p className="text-center text-gray-500 py-4">Nenhuma disciplina cadastrada para esta turma.</p>
        ) : (
          <div className="mb-8">
            <table className="min-w-full border-collapse border border-gray-400">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-400 px-4 py-2 text-left font-bold text-gray-700">Disciplina</th>
                  {selectedBimester !== 'annual' && Array.from({ length: numberOfGrades }).map((_, i) => (
                    <th key={`th-n${i+1}`} className="border border-gray-400 px-4 py-2 text-center font-bold text-gray-700">
                      Nota {i + 1}
                    </th>
                  ))}
                  {selectedBimester !== 'annual' && (
                    <th className="border border-gray-400 px-4 py-2 text-center font-bold text-gray-700">Recuperação</th>
                  )}
                  {selectedBimester === 'annual' && (
                    <th className="border border-gray-400 px-4 py-2 text-center font-bold text-gray-700">Média Anual</th>
                  )}
                  {selectedBimester === 'annual' && (
                    <th className="border border-gray-400 px-4 py-2 text-center font-bold text-gray-700">Exame Final</th>
                  )}
                  <th className="border border-gray-400 px-4 py-2 text-center font-bold text-gray-700">Média Final</th>
                  <th className="border border-gray-400 px-4 py-2 text-center font-bold text-gray-700">Situação</th>
                </tr>
              </thead>
              <tbody>
                {subjectsToDisplay.map((subject: string) => {
                  const subjectGrades = grades[subject] || {};
                  const g = subjectGrades[selectedBimester] || {};

                  if (selectedBimester === 'annual') {
                    let annualAverage = null;
                    let sum = 0;
                    let count = 0;
                    for (let i = 1; i <= 4; i++) {
                      if (subjectGrades[i]?.average !== undefined && subjectGrades[i]?.average !== null) {
                        sum += subjectGrades[i].average;
                        count++;
                      }
                    }
                    if (count === 4) {
                      annualAverage = Number((sum / 4).toFixed(1));
                    }

                    const finalExam = g.finalExam !== undefined && g.finalExam !== null ? g.finalExam : '-';
                    const isApproved = (finalExam !== '-' && finalExam >= 7) || (annualAverage !== null && annualAverage >= 7);
                    const isFailed = !isApproved && annualAverage !== null;
                    const finalGrade = annualAverage !== null ? (isApproved ? (annualAverage >= 7 ? annualAverage : finalExam) : '-') : '-';

                    return (
                      <tr key={subject} className="hover:bg-gray-50">
                        <td className="border border-gray-400 px-4 py-3 font-medium text-gray-900">{subject}</td>
                        <td className="border border-gray-400 px-4 py-3 text-center text-gray-700">
                          {annualAverage !== null ? annualAverage : '-'}
                        </td>
                        <td className="border border-gray-400 px-4 py-3 text-center text-blue-600">
                          {finalExam}
                        </td>
                        <td className="border border-gray-400 px-4 py-3 text-center font-bold">
                          {finalGrade}
                        </td>
                        <td className={`border border-gray-400 px-4 py-3 text-center font-bold ${isApproved ? 'text-green-600' : isFailed ? 'text-red-600' : 'text-gray-500'}`}>
                          {annualAverage !== null ? (isApproved ? 'Aprovado' : 'Reprovado') : '-'}
                        </td>
                      </tr>
                    );
                  }

                  const avg = g.average !== undefined && g.average !== null ? g.average : '-';
                  const isApproved = avg !== '-' && avg >= 7;
                  const isFailed = avg !== '-' && avg < 7;

                  return (
                    <tr key={subject} className="hover:bg-gray-50">
                      <td className="border border-gray-400 px-4 py-3 font-medium text-gray-900">{subject}</td>
                      {Array.from({ length: numberOfGrades }).map((_, i) => (
                        <td key={`td-n${i+1}`} className="border border-gray-400 px-4 py-3 text-center text-gray-700">
                          {g[`n${i+1}`] !== undefined ? g[`n${i+1}`] : '-'}
                        </td>
                      ))}
                      <td className="border border-gray-400 px-4 py-3 text-center text-amber-600 font-medium">
                        {g.recovery !== undefined ? g.recovery : '-'}
                      </td>
                      <td className="border border-gray-400 px-4 py-3 text-center font-bold">
                        {avg}
                      </td>
                      <td className={`border border-gray-400 px-4 py-3 text-center font-bold ${isApproved ? 'text-green-600' : isFailed ? 'text-red-600' : 'text-gray-500'}`}>
                        {avg !== '-' ? (isApproved ? 'Aprovado' : 'Reprovado') : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
    </div>
  );
}
