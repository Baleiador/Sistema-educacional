import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';
import { format, isBefore, isAfter, isWeekend, addDays, parseISO, startOfDay, endOfDay } from 'date-fns';
import { AlertCircle } from 'lucide-react';

import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { userData } = useAuth();
  const [school, setSchool] = useState<any>(null);
  const [academicYearStart, setAcademicYearStart] = useState('');
  const [academicYearEnd, setAcademicYearEnd] = useState('');
  const [saving, setSaving] = useState(false);
  
  const [pendingLessons, setPendingLessons] = useState<{classId: string, className: string, date: string}[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);

  useEffect(() => {
    if (userData?.schoolId) {
      getDoc(doc(db, 'schools', userData.schoolId)).then(docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSchool(data);
          if (data.academicYearStart) setAcademicYearStart(data.academicYearStart);
          if (data.academicYearEnd) setAcademicYearEnd(data.academicYearEnd);
        }
      });
    }
  }, [userData?.schoolId]);

  useEffect(() => {
    if (userData?.role === 'teacher' && school?.academicYearStart && school?.academicYearEnd) {
      calculatePendingLessons();
    }
  }, [userData, school]);

  const calculatePendingLessons = async () => {
    if (!userData?.schoolId || !userData?.uid) return;
    setLoadingPending(true);
    try {
      // Get classes for this teacher
      const qClasses = query(collection(db, 'classes'), where('schoolId', '==', userData.schoolId));
      const classesSnap = await getDocs(qClasses);
      const teacherClasses = classesSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(c => c.teacherIds && c.teacherIds.includes(userData.uid));

      if (teacherClasses.length === 0) {
        setPendingLessons([]);
        setLoadingPending(false);
        return;
      }

      // Get all lessons for these classes
      const qLessons = query(collection(db, 'lessons'), where('schoolId', '==', userData.schoolId));
      const lessonsSnap = await getDocs(qLessons);
      const lessonsByClass: Record<string, Set<string>> = {};
      lessonsSnap.docs.forEach(d => {
        const data = d.data();
        if (!lessonsByClass[data.classId]) {
          lessonsByClass[data.classId] = new Set();
        }
        lessonsByClass[data.classId].add(data.date);
      });

      // Calculate expected dates
      const start = parseISO(school.academicYearStart);
      const end = parseISO(school.academicYearEnd);
      const today = startOfDay(new Date());
      const actualEnd = isBefore(today, end) ? today : end;

      const pending: {classId: string, className: string, date: string}[] = [];
      
      teacherClasses.forEach(c => {
        const postedDates = lessonsByClass[c.id] || new Set();
        
        // Determine start date for this class
        let classStart = start;
        if (c.createdAt) {
          try {
            // c.createdAt might be a Firestore Timestamp
            const createdAtDate = c.createdAt.toDate ? startOfDay(c.createdAt.toDate()) : startOfDay(new Date(c.createdAt));
            if (isAfter(createdAtDate, start)) {
              classStart = createdAtDate;
            }
          } catch (e) {
            console.error("Error parsing class createdAt:", e);
          }
        }

        let currentDate = classStart;
        while (isBefore(currentDate, actualEnd) || currentDate.getTime() === actualEnd.getTime()) {
          if (!isWeekend(currentDate)) {
            const dateStr = format(currentDate, 'yyyy-MM-dd');
            if (!postedDates.has(dateStr)) {
              pending.push({ classId: c.id, className: c.name, date: dateStr });
            }
          }
          currentDate = addDays(currentDate, 1);
        }
      });

      // Sort by date descending
      pending.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setPendingLessons(pending);

    } catch (error) {
      console.error("Error calculating pending lessons:", error);
    } finally {
      setLoadingPending(false);
    }
  };

  const handleSaveAcademicYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData?.schoolId) return;
    
    setSaving(true);
    try {
      await updateDoc(doc(db, 'schools', userData.schoolId), {
        academicYearStart,
        academicYearEnd
      });
      setSchool({ ...school, academicYearStart, academicYearEnd });
      toast.success('Ano letivo atualizado com sucesso!');
    } catch (error) {
      toast.error('Erro ao atualizar ano letivo.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userData?.schoolId) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 200;
        const MAX_HEIGHT = 200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

        try {
          await updateDoc(doc(db, 'schools', userData.schoolId), {
            logo: dataUrl
          });
          setSchool({ ...school, logo: dataUrl });
          toast.success('Logo atualizada com sucesso!');
        } catch (error) {
          toast.error('Erro ao atualizar logo.');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6 flex flex-col items-center justify-center text-center">
        <div className="flex flex-col md:flex-row items-center justify-center gap-6 w-full max-w-3xl">
          {school?.logo ? (
            <img src={school.logo} alt="Logo da Escola" className="h-32 w-auto object-contain rounded-lg" />
          ) : (
            <div className="h-32 w-32 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
              <span className="text-gray-400 text-4xl">{school?.name?.charAt(0)}</span>
            </div>
          )}
          
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <h3 className="text-2xl font-bold leading-6 text-gray-900 mb-2">{school?.name || 'Carregando...'}</h3>
            
            {(school?.address || school?.cnpj || school?.responsible) && (
              <div className="text-sm text-gray-600 space-y-1">
                {school.address && <p><strong>Endereço:</strong> {school.address}</p>}
                {school.cnpj && <p><strong>CNPJ/MEI:</strong> {school.cnpj}</p>}
                {school.responsible && <p><strong>Responsável:</strong> {school.responsible}</p>}
              </div>
            )}
          </div>
        </div>

        {userData?.role === 'admin' && school && (
          <div className="mt-6 p-4 bg-indigo-50 rounded-md inline-block border border-indigo-100">
            <p className="text-indigo-700">
              Código de Convite para Professores: <span className="font-bold text-lg ml-2">{school.inviteCode}</span>
            </p>
          </div>
        )}
      </div>

      {userData?.role === 'admin' && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Configurações da Escola</h3>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Logo da Escola</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
            <p className="mt-1 text-xs text-gray-500">A imagem será redimensionada automaticamente.</p>
          </div>

          <form onSubmit={handleSaveAcademicYear} className="space-y-4 max-w-md border-t border-gray-200 pt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Início do Ano Letivo</label>
              <input
                type="date"
                required
                value={academicYearStart}
                onChange={(e) => setAcademicYearStart(e.target.value)}
                className="mt-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Fim do Ano Letivo</label>
              <input
                type="date"
                required
                value={academicYearEnd}
                onChange={(e) => setAcademicYearEnd(e.target.value)}
                className="mt-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {saving ? 'Salvando...' : 'Salvar Ano Letivo'}
            </button>
          </form>
        </div>
      )}

      {userData?.role === 'teacher' && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4 flex items-center">
            <AlertCircle className="h-5 w-5 text-amber-500 mr-2" />
            Aulas Pendentes de Lançamento
          </h3>
          
          {!school?.academicYearStart || !school?.academicYearEnd ? (
            <p className="text-sm text-gray-500">O administrador ainda não configurou as datas do ano letivo.</p>
          ) : loadingPending ? (
            <p className="text-sm text-gray-500">Carregando aulas pendentes...</p>
          ) : pendingLessons.length === 0 ? (
            <p className="text-sm text-green-600 font-medium">Parabéns! Todas as suas aulas estão em dia.</p>
          ) : (
            <div>
              <p className="text-sm text-amber-600 font-medium mb-4">
                Você tem {pendingLessons.length} {pendingLessons.length === 1 ? 'aula pendente' : 'aulas pendentes'} de lançamento.
              </p>
              <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-md">
                <ul className="divide-y divide-gray-200">
                  {pendingLessons.map((lesson, idx) => (
                    <li key={idx} className="p-4 hover:bg-gray-50 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{lesson.className}</p>
                        <p className="text-sm text-gray-500">{format(parseISO(lesson.date), 'dd/MM/yyyy')}</p>
                      </div>
                      <Link
                        to={`/teacher/lessons?classId=${lesson.classId}&date=${lesson.date}`}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                      >
                        Lançar Aula
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
