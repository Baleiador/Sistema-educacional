import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, getDoc, where, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';

export default function Lessons() {
  const { userData } = useAuth();
  const [searchParams] = useSearchParams();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState(searchParams.get('classId') || '');
  const [date, setDate] = useState(searchParams.get('date') || format(new Date(), 'yyyy-MM-dd'));
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [previousLessons, setPreviousLessons] = useState<any[]>([]);

  useEffect(() => {
    const classIdParam = searchParams.get('classId');
    const dateParam = searchParams.get('date');
    if (classIdParam) setSelectedClass(classIdParam);
    if (dateParam) setDate(dateParam);
  }, [searchParams]);

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
      setPreviousLessons([]);
      return;
    }

    // Load existing lesson for the selected date
    const loadLesson = async () => {
      const lessonId = `${selectedClass}_${date}`;
      const docRef = doc(db, 'lessons', lessonId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setContent(docSnap.data().content || '');
      } else {
        setContent('');
      }
    };
    loadLesson();

    // Load previous lessons for the class
    const qLessons = query(
      collection(db, 'lessons'),
      where('classId', '==', selectedClass),
      where('schoolId', '==', userData.schoolId)
    );
    const unsubLessons = onSnapshot(qLessons, (snapshot) => {
      const lessons = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      // Sort in memory since we might not have a composite index yet
      lessons.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setPreviousLessons(lessons);
    }, (error) => {
      console.error("Error fetching lessons:", error);
    });

    return () => unsubLessons();
  }, [selectedClass, date, userData?.schoolId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || !date || !content.trim() || !userData?.schoolId) return;
    
    setLoading(true);
    try {
      const lessonId = `${selectedClass}_${date}`;
      await setDoc(doc(db, 'lessons', lessonId), {
        classId: selectedClass,
        schoolId: userData.schoolId,
        date,
        content,
        teacherId: userData?.uid,
        updatedAt: new Date().toISOString(),
      });
      toast.success('Conteúdo salvo com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar conteúdo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900 mb-6">Conteúdo de Aula</h3>
        
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

          {selectedClass && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Conteúdo Ministrado</label>
              <div className="mt-1">
                <textarea
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder="Descreva o conteúdo ministrado nesta aula..."
                />
              </div>
            </div>
          )}

          {selectedClass && (
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                {loading ? 'Salvando...' : 'Salvar Conteúdo'}
              </button>
            </div>
          )}
        </form>
      </div>

      {selectedClass && previousLessons.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Aulas Anteriores</h3>
          <div className="space-y-4">
            {previousLessons.map((lesson) => (
              <div key={lesson.id} className="border-l-4 border-indigo-500 pl-4 py-2">
                <p className="text-sm font-medium text-gray-900">{format(new Date(lesson.date), 'dd/MM/yyyy')}</p>
                <p className="text-sm text-gray-500 mt-1 whitespace-pre-wrap">{lesson.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
