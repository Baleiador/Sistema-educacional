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
  const [grades, setGrades] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(true);

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
        const gradesMap: Record<number, any> = {};
        gradesSnap.docs.forEach(d => {
          const data = d.data();
          gradesMap[data.bimester] = data;
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

  const bimesters = [1, 2, 3, 4];

  return (
    <div className="bg-white shadow rounded-lg p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6 print:hidden">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </button>
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
        <div className="text-center mb-8 border-b-2 border-gray-800 pb-6">
          {school?.logo && (
            <img src={school.logo} alt="Logo da Escola" className="h-24 w-auto mx-auto mb-4 object-contain" />
          )}
          <h1 className="text-3xl font-bold text-gray-900 uppercase tracking-wider">{school?.name || 'Escola'}</h1>
          <h2 className="text-xl font-semibold text-gray-700 mt-2">Boletim Escolar</h2>
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
              const g = grades[b] || {};
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
