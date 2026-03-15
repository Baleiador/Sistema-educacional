import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, getDoc, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function Attendance() {
  const { userData } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userData?.schoolId) return;
    const qClasses = query(collection(db, 'classes'), where('schoolId', '==', userData.schoolId));
    const unsubClasses = onSnapshot(qClasses, (snapshot) => {
      const allClasses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      const filtered = allClasses.filter((c: any) => userData?.role === 'admin' || (c.teacherIds && c.teacherIds.includes(userData?.uid)));
      filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setClasses(filtered);
    }, (error) => {
      console.error("Error fetching classes:", error);
    });
    return () => unsubClasses();
  }, [userData?.schoolId]);

  useEffect(() => {
    if (!selectedClass || !userData?.schoolId) {
      setStudents([]);
      return;
    }
    const qStudents = query(collection(db, 'students'), where('schoolId', '==', userData.schoolId));
    const unsubStudents = onSnapshot(qStudents, (snapshot) => {
      const allStudents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      const filtered = allStudents.filter((s: any) => s.classId === selectedClass);
      filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setStudents(filtered);
    }, (error) => {
      console.error("Error fetching students:", error);
    });

    // Load existing attendance
    const loadAttendance = async () => {
      const attendanceId = `${selectedClass}_${date}`;
      const docRef = doc(db, 'attendance', attendanceId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setAttendance(docSnap.data().records || {});
      } else {
        setAttendance({});
      }
    };
    loadAttendance();

    return () => unsubStudents();
  }, [selectedClass, date, userData?.schoolId]);

  const handleMark = (studentId: string, status: string) => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const handleSave = async () => {
    if (!selectedClass || !date || !userData?.schoolId) return;
    setLoading(true);
    try {
      const attendanceId = `${selectedClass}_${date}`;
      await setDoc(doc(db, 'attendance', attendanceId), {
        classId: selectedClass,
        schoolId: userData.schoolId,
        date,
        teacherId: userData?.uid,
        records: attendance,
        updatedAt: new Date().toISOString(),
      });
      toast.success('Chamada salva com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar chamada.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-medium leading-6 text-gray-900 mb-6">Chamada</h3>
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Turma</label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="mt-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
          >
            <option value="">Selecione a Turma</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Data</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
          />
        </div>
      </div>

      {selectedClass && students.length > 0 && (
        <>
          <div className="overflow-x-auto mb-6">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aluno</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Presença</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {students.map((student) => (
                  <tr key={student.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{student.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex justify-center gap-2">
                      <button
                        onClick={() => handleMark(student.id, 'present')}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          attendance[student.id] === 'present' ? 'bg-green-100 text-green-800 border-green-200 border' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        Presente
                      </button>
                      <button
                        onClick={() => handleMark(student.id, 'absent')}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          attendance[student.id] === 'absent' ? 'bg-red-100 text-red-800 border-red-200 border' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        Falta
                      </button>
                      <button
                        onClick={() => handleMark(student.id, 'late')}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          attendance[student.id] === 'late' ? 'bg-yellow-100 text-yellow-800 border-yellow-200 border' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        Atraso
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={loading}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              {loading ? 'Salvando...' : 'Salvar Chamada'}
            </button>
          </div>
        </>
      )}
      {selectedClass && students.length === 0 && (
        <p className="text-gray-500 text-sm">Nenhum aluno cadastrado nesta turma.</p>
      )}
    </div>
  );
}
