import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { File, Trash2, Upload, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

export default function Documents() {
  const { userData } = useAuth();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userData?.schoolId) return;

    const q = query(collection(db, 'documents'), where('schoolId', '==', userData.schoolId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      docsList.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
      setDocuments(docsList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData?.schoolId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userData?.schoolId) return;

    // Limit file size to 500KB to avoid Firestore limits
    if (file.size > 500 * 1024) {
      toast.error('O arquivo deve ter no máximo 500KB.');
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const base64 = evt.target?.result as string;
        await addDoc(collection(db, 'documents'), {
          name: file.name,
          type: file.type,
          size: file.size,
          data: base64,
          schoolId: userData.schoolId,
          uploadedBy: userData.uid,
          createdAt: serverTimestamp(),
        });
        toast.success('Documento enviado com sucesso!');
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (error) {
        console.error(error);
        toast.error('Erro ao enviar documento.');
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = async (docId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este documento?')) return;
    try {
      await deleteDoc(doc(db, 'documents', docId));
      toast.success('Documento excluído com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir documento.');
    }
  };

  if (loading) return <div className="p-6">Carregando...</div>;

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Documentos da Escola</h2>
        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.png"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400"
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? 'Enviando...' : 'Novo Documento'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tamanho</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {documents.map((doc) => (
              <tr key={doc.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 flex items-center">
                  <File className="h-5 w-5 text-gray-400 mr-2" />
                  {doc.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {(doc.size / 1024).toFixed(1)} KB
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {doc.createdAt ? format(doc.createdAt.toDate(), 'dd/MM/yyyy HH:mm') : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <a
                    href={doc.data}
                    download={doc.name}
                    className="text-indigo-600 hover:text-indigo-900 mr-4 inline-flex items-center"
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Baixar
                  </a>
                  {userData?.role === 'admin' && (
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {documents.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                  Nenhum documento enviado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
