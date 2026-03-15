import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { Printer } from 'lucide-react';

export default function Grades() {
  const { userData } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [bimester, setBimester] = useState<number | 'annual'>(1);
  const [students, setStudents] = useState<any[]>([]);
  const [grades, setGrades] = useState<Record<string, any>>({});
  const [annualGrades, setAnnualGrades] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [school, setSchool] = useState<any>(null);

  const selectedClassData = classes.find(c => c.id === selectedClass);
  const classSubjects = selectedClassData?.subjects || [];
  const availableSubjects = userData?.role === 'admin' 
    ? classSubjects 
    : classSubjects.filter((s: string) => (userData?.subjects || []).includes(s));
  const canEdit = userData?.role === 'admin' || (userData?.subjects || []).includes(selectedSubject);

  useEffect(() => {
    if (!userData?.schoolId) return;
    
    // Fetch school settings
    getDoc(doc(db, 'schools', userData.schoolId)).then(docSnap => {
      if (docSnap.exists()) {
        setSchool(docSnap.data());
      }
    });

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
    if (!selectedClass || !selectedSubject || !userData?.schoolId) {
      setStudents([]);
      setGrades({});
      return;
    }

    const qStudents = query(
      collection(db, 'students'), 
      where('classId', '==', selectedClass),
      where('schoolId', '==', userData.schoolId)
    );
    const unsubStudents = onSnapshot(qStudents, (snapshot) => {
      const studentsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      studentsList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setStudents(studentsList);
    }, (error) => {
      console.error("Error fetching students:", error);
    });

    const fetchGrades = async () => {
      if (bimester === 'annual') {
        const qGrades = query(
          collection(db, 'grades'), 
          where('classId', '==', selectedClass),
          where('subject', '==', selectedSubject),
          where('schoolId', '==', userData.schoolId)
        );
        const gradesSnap = await getDocs(qGrades);
        const allGradesMap: Record<string, any> = {};
        const annualGradesMap: Record<string, any> = {};
        
        gradesSnap.docs.forEach(doc => {
          const data = doc.data();
          if (data.bimester === 'annual') {
            annualGradesMap[data.studentId] = data;
          } else {
            if (!allGradesMap[data.studentId]) allGradesMap[data.studentId] = {};
            allGradesMap[data.studentId][data.bimester] = data.average;
          }
        });
        setAnnualGrades(allGradesMap);
        setGrades(annualGradesMap);
      } else {
        const qGrades = query(
          collection(db, 'grades'), 
          where('classId', '==', selectedClass),
          where('bimester', '==', bimester),
          where('subject', '==', selectedSubject),
          where('schoolId', '==', userData.schoolId)
        );
        const gradesSnap = await getDocs(qGrades);
        const gradesMap: Record<string, any> = {};
        gradesSnap.docs.forEach(doc => {
          const data = doc.data();
          gradesMap[data.studentId] = data;
        });
        setGrades(gradesMap);
      }
    };

    fetchGrades();

    return () => unsubStudents();
  }, [selectedClass, bimester, selectedSubject, userData?.schoolId]);

  const gradingSystem = school?.gradingSystem || { numberOfGrades: 3, weights: [1, 1, 1] };
  const numberOfGrades = gradingSystem.numberOfGrades;
  const weights = gradingSystem.weights;

  const handleGradeChange = (studentId: string, field: string, value: string) => {
    const numValue = value === '' ? '' : Number(value);
    if (numValue !== '' && (numValue < 0 || numValue > 10)) return;

    setGrades(prev => {
      const studentGrades = prev[studentId] || { recovery: '' };
      const updatedGrades = { ...studentGrades, [field]: numValue };
      
      if (bimester === 'annual') {
        // For annual, we don't calculate an average here, we just store the finalExam grade
        return { ...prev, [studentId]: updatedGrades };
      }

      // Calculate average
      let totalWeight = 0;
      let weightedSum = 0;
      let count = 0;

      for (let i = 1; i <= numberOfGrades; i++) {
        const gradeVal = updatedGrades[`n${i}`];
        if (gradeVal !== '' && gradeVal !== undefined) {
          count++;
          const weight = weights[i - 1] || 1;
          weightedSum += Number(gradeVal) * weight;
          totalWeight += weight;
        }
      }

      const recovery = updatedGrades.recovery !== '' && updatedGrades.recovery !== undefined ? Number(updatedGrades.recovery) : null;
      
      if (count === numberOfGrades && totalWeight > 0) {
        const baseAvg = Number((weightedSum / totalWeight).toFixed(1));
        if (recovery !== null && recovery > baseAvg) {
          updatedGrades.average = recovery;
        } else {
          updatedGrades.average = baseAvg;
        }
      } else {
        updatedGrades.average = null;
      }

      return { ...prev, [studentId]: updatedGrades };
    });
  };

  const handleSave = async () => {
    if (!selectedClass || !selectedSubject || !userData?.schoolId) {
      toast.error('Selecione a turma e a disciplina.');
      return;
    }
    setLoading(true);
    
    try {
      const promises = students.map(student => {
        const studentGrades = grades[student.id];
        if (!studentGrades) return Promise.resolve();

        const gradeId = `${selectedClass}_${student.id}_${bimester}_${selectedSubject}`;
        const gradeData: any = {
          schoolId: userData.schoolId,
          classId: selectedClass,
          studentId: student.id,
          bimester: bimester,
          subject: selectedSubject,
        };

        if (bimester === 'annual') {
          if (studentGrades.finalExam !== '' && studentGrades.finalExam !== undefined) {
            gradeData.finalExam = Number(studentGrades.finalExam);
          }
        } else {
          for (let i = 1; i <= numberOfGrades; i++) {
            if (studentGrades[`n${i}`] !== '' && studentGrades[`n${i}`] !== undefined) {
              gradeData[`n${i}`] = Number(studentGrades[`n${i}`]);
            }
          }

          if (studentGrades.recovery !== '' && studentGrades.recovery !== undefined) gradeData.recovery = Number(studentGrades.recovery);
          if (studentGrades.average !== null && studentGrades.average !== undefined) {
            gradeData.average = Number(studentGrades.average);
          }
        }

        return setDoc(doc(db, 'grades', gradeId), gradeData, { merge: true });
      });

      await Promise.all(promises);
      toast.success('Notas salvas com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar notas.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Lançamento de Notas</h3>
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Turma</label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            <option value="">Selecione uma turma</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Disciplina</label>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            <option value="">Selecione uma disciplina</option>
            {availableSubjects.map((subject: string) => (
              <option key={subject} value={subject}>{subject}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Bimestre</label>
          <select
            value={bimester}
            onChange={(e) => setBimester(e.target.value === 'annual' ? 'annual' : Number(e.target.value))}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            <option value={1}>1º Bimestre</option>
            <option value={2}>2º Bimestre</option>
            <option value={3}>3º Bimestre</option>
            <option value={4}>4º Bimestre</option>
            <option value="annual">Anual (Nota Final)</option>
          </select>
        </div>
      </div>

      {selectedClass && selectedSubject && students.length > 0 && (
        <>
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-md font-medium text-gray-700">Alunos</h4>
            <div className="flex items-center space-x-4">
              {!canEdit && (
                <span className="text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-full font-medium">
                  Modo de visualização (somente leitura)
                </span>
              )}
              <Link
                to={`/teacher/report-cards/class/${selectedClass}`}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <Printer className="h-4 w-4 mr-2" />
                Imprimir Boletins da Turma
              </Link>
            </div>
          </div>
          <div className="overflow-x-auto mb-4">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aluno</th>
                  {bimester === 'annual' ? (
                    <>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Média 1º Bim</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Média 2º Bim</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Média 3º Bim</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Média 4º Bim</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Média Anual</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Nota Final</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Situação Final</th>
                    </>
                  ) : (
                    <>
                      {Array.from({ length: numberOfGrades }).map((_, i) => (
                        <th key={`th-n${i+1}`} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Nota {i + 1}
                        </th>
                      ))}
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Recuperação</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Média Final</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Situação</th>
                    </>
                  )}
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {students.map((student) => {
                  const studentGrades = grades[student.id] || { recovery: '', average: null, finalExam: '' };
                  const studentAnnualGrades = annualGrades[student.id] || {};
                  
                  let annualAverage = null;
                  if (bimester === 'annual') {
                    let sum = 0;
                    let count = 0;
                    for (let i = 1; i <= 4; i++) {
                      if (studentAnnualGrades[i] !== undefined && studentAnnualGrades[i] !== null) {
                        sum += studentAnnualGrades[i];
                        count++;
                      }
                    }
                    if (count === 4) {
                      annualAverage = Number((sum / 4).toFixed(1));
                    }
                  }

                  return (
                    <tr key={student.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {student.name}
                      </td>
                      {bimester === 'annual' ? (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                            {studentAnnualGrades[1] !== undefined ? studentAnnualGrades[1] : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                            {studentAnnualGrades[2] !== undefined ? studentAnnualGrades[2] : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                            {studentAnnualGrades[3] !== undefined ? studentAnnualGrades[3] : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                            {studentAnnualGrades[4] !== undefined ? studentAnnualGrades[4] : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-center">
                            {annualAverage !== null ? annualAverage : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                            <input
                              type="number"
                              min="0"
                              max="10"
                              step="0.1"
                              value={studentGrades.finalExam || ''}
                              onChange={(e) => handleGradeChange(student.id, 'finalExam', e.target.value)}
                              disabled={!canEdit}
                              className="w-20 text-center border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                            {annualAverage !== null ? (
                              (studentGrades.finalExam !== undefined && studentGrades.finalExam !== '' && Number(studentGrades.finalExam) >= 7) || annualAverage >= 7 ? (
                                <span className="text-green-600">Aprovado</span>
                              ) : (
                                <span className="text-red-600">Reprovado</span>
                              )
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          {Array.from({ length: numberOfGrades }).map((_, i) => (
                            <td key={`td-n${i+1}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                              <input
                                type="number"
                                min="0"
                                max="10"
                                step="0.1"
                                value={studentGrades[`n${i+1}`] || ''}
                                onChange={(e) => handleGradeChange(student.id, `n${i+1}`, e.target.value)}
                                disabled={!canEdit}
                                className="w-20 text-center border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
                              />
                            </td>
                          ))}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                            <input
                              type="number"
                              min="0"
                              max="10"
                              step="0.1"
                              value={studentGrades.recovery || ''}
                              onChange={(e) => handleGradeChange(student.id, 'recovery', e.target.value)}
                              disabled={!canEdit}
                              className="w-20 text-center border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-center">
                            {studentGrades.average !== null && studentGrades.average !== undefined ? studentGrades.average : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                            {studentGrades.average !== null && studentGrades.average !== undefined ? (
                              studentGrades.average >= 7 ? (
                                <span className="text-green-600">Aprovado</span>
                              ) : (
                                <span className="text-red-600">Reprovado</span>
                              )
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        <Link
                          to={`/teacher/report-card/${student.id}`}
                          className="text-indigo-600 hover:text-indigo-900 font-medium"
                        >
                          Boletim
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={loading || !canEdit}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Salvando...' : 'Salvar Notas'}
            </button>
          </div>
        </>
      )}
      {selectedClass && students.length === 0 && (
        <p className="text-gray-500 text-center py-4">Nenhum aluno encontrado nesta turma.</p>
      )}
    </div>
  );
}
