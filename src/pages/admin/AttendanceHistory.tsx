import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { Printer } from 'lucide-react';

export default function AttendanceHistory() {
  const { userData } = useAuth();
  const [attendances, setAttendances] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [startDate, setStartDate] = useState(format(new Date(new Date().setDate(new Date().getDate() - 30)), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedClass, setSelectedClass] = useState('');

  useEffect(() => {
    if (!userData?.schoolId) return;

    const qClasses = query(collection(db, 'classes'), where('schoolId', '==', userData.schoolId));
    const unsubClasses = onSnapshot(qClasses, (snapshot) => {
      const classesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      classesList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setClasses(classesList);
    });

    const qStudents = query(collection(db, 'students'), where('schoolId', '==', userData.schoolId));
    const unsubStudents = onSnapshot(qStudents, (snapshot) => {
      const studentsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setStudents(studentsList);
    });

    const qAttendances = query(collection(db, 'attendance'), where('schoolId', '==', userData.schoolId));
    const unsubAttendances = onSnapshot(qAttendances, (snapshot) => {
      const attendanceList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setAttendances(attendanceList);
      setLoading(false);
    });

    return () => {
      unsubClasses();
      unsubStudents();
      unsubAttendances();
    };
  }, [userData?.schoolId]);

  const filteredAttendances = attendances.filter(a => {
    const dateMatch = a.date >= startDate && a.date <= endDate;
    const classMatch = selectedClass ? a.classId === selectedClass : true;
    return dateMatch && classMatch;
  }).sort((a, b) => b.date.localeCompare(a.date));

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="p-6">Carregando...</div>;

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Histórico de Chamadas</h2>
        <button
          onClick={handlePrint}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 print:hidden"
        >
          <Printer className="h-4 w-4 mr-2" />
          Imprimir
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 print:hidden">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data Inicial</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data Final</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Turma</label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            <option value="">Todas as Turmas</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Turma</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Disciplina</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Presentes</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Faltas</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAttendances.map((attendance) => {
              const cls = classes.find(c => c.id === attendance.classId);
              const classStudents = students.filter(s => s.classId === attendance.classId);
              const presentCount = Object.values(attendance.records).filter(Boolean).length;
              const absentCount = classStudents.length - presentCount;

              return (
                <tr key={attendance.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {format(new Date(attendance.date + 'T00:00:00'), 'dd/MM/yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {cls?.name || 'Turma não encontrada'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {attendance.subject}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                    {presentCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                    {absentCount}
                  </td>
                </tr>
              );
            })}
            {filteredAttendances.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                  Nenhuma chamada encontrada para o período selecionado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
