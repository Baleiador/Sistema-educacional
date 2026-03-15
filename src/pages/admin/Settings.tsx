import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Trash2, Plus, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Settings() {
  const { userData } = useAuth();
  const [school, setSchool] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Grade settings
  const [numberOfGrades, setNumberOfGrades] = useState(3);
  const [weights, setWeights] = useState<number[]>([1, 1, 1]);

  // School info settings
  const [address, setAddress] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [responsible, setResponsible] = useState('');

  // Subjects settings
  const [subjects, setSubjects] = useState<string[]>([]);
  const [newSubject, setNewSubject] = useState('');

  useEffect(() => {
    if (userData?.schoolId) {
      getDoc(doc(db, 'schools', userData.schoolId)).then(docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSchool(data);
          setAddress(data.address || '');
          setCnpj(data.cnpj || '');
          setResponsible(data.responsible || '');
          setSubjects(data.subjects || []);
          if (data.gradingSystem) {
            setNumberOfGrades(data.gradingSystem.numberOfGrades || 3);
            setWeights(data.gradingSystem.weights || [1, 1, 1]);
          }
        }
        setLoading(false);
      });
    }
  }, [userData?.schoolId]);

  const handleAddSubject = () => {
    if (newSubject.trim() && !subjects.includes(newSubject.trim())) {
      setSubjects([...subjects, newSubject.trim()]);
      setNewSubject('');
    }
  };

  const handleRemoveSubject = (subjectToRemove: string) => {
    setSubjects(subjects.filter(s => s !== subjectToRemove));
  };

  const handleNumberOfGradesChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const num = parseInt(e.target.value);
    setNumberOfGrades(num);
    // Adjust weights array
    setWeights(prev => {
      const newWeights = [...prev];
      while (newWeights.length < num) newWeights.push(1);
      return newWeights.slice(0, num);
    });
  };

  const handleWeightChange = (index: number, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) return;
    
    setWeights(prev => {
      const newWeights = [...prev];
      newWeights[index] = num;
      return newWeights;
    });
  };

  const handleSave = async () => {
    if (!userData?.schoolId) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'schools', userData.schoolId), {
        address,
        cnpj,
        responsible,
        subjects,
        gradingSystem: {
          numberOfGrades,
          weights
        }
      });
      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Carregando...</div>;

  return (
    <div className="bg-white shadow rounded-lg p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Configurações da Escola</h2>

      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4 border-b pb-2">Informações da Instituição</h3>
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Endereço Completo
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua, Número, Bairro, Cidade - UF"
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CNPJ / MEI
              </label>
              <input
                type="text"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                placeholder="00.000.000/0000-00"
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Responsável
              </label>
              <input
                type="text"
                value={responsible}
                onChange={(e) => setResponsible(e.target.value)}
                placeholder="Nome do Diretor/Coordenador"
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              />
            </div>
          </div>
        </div>

        <div className="pt-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4 border-b pb-2">Disciplinas</h3>
          <div className="mb-4">
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddSubject()}
                placeholder="Nova disciplina (ex: Matemática)"
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              />
              <button
                onClick={handleAddSubject}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {subjects.map((subject) => (
                <span key={subject} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                  {subject}
                  <button
                    type="button"
                    onClick={() => handleRemoveSubject(subject)}
                    className="flex-shrink-0 ml-1.5 h-4 w-4 rounded-full inline-flex items-center justify-center text-gray-400 hover:bg-gray-200 hover:text-gray-500 focus:outline-none focus:bg-gray-500 focus:text-white"
                  >
                    <span className="sr-only">Remover disciplina</span>
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {subjects.length === 0 && (
                <span className="text-sm text-gray-500 italic">Nenhuma disciplina cadastrada.</span>
              )}
            </div>
          </div>
        </div>

        <div className="pt-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4 border-b pb-2">Sistema de Notas</h3>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantidade de Notas por Bimestre
            </label>
            <select
              value={numberOfGrades}
              onChange={handleNumberOfGradesChange}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              <option value={1}>1 Nota</option>
              <option value={2}>2 Notas</option>
              <option value={3}>3 Notas</option>
              <option value={4}>4 Notas</option>
              <option value={5}>5 Notas</option>
            </select>
            <p className="mt-1 text-sm text-gray-500">
              Define quantas notas regulares os professores poderão lançar em cada bimestre (sem contar a recuperação).
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pesos das Notas
            </label>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              {Array.from({ length: numberOfGrades }).map((_, i) => (
                <div key={i}>
                  <label className="block text-xs text-gray-500 mb-1">Nota {i + 1}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={weights[i]}
                    onChange={(e) => handleWeightChange(i, e.target.value)}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
              ))}
            </div>
            <p className="mt-2 text-sm text-gray-500">
              A média do bimestre será calculada como uma média ponderada usando estes pesos. Se todos os pesos forem iguais (ex: 1), será uma média aritmética simples.
            </p>
          </div>
        </div>

        <div className="pt-4">
          <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h3 className="text-lg font-medium text-gray-900">Documentos</h3>
            <Link
              to="/admin/documents"
              className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Acessar Menu de Documentos
              <ExternalLink className="ml-1 h-4 w-4" />
            </Link>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Gerencie os documentos da escola no menu dedicado. Lá você pode fazer upload de arquivos e disponibilizá-los para a equipe.
          </p>
        </div>

        <div className="pt-4 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
          >
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      </div>
    </div>
  );
}
