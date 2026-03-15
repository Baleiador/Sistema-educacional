import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { File, Trash2, Upload, ExternalLink, Edit2, Printer, X } from 'lucide-react';
import { format } from 'date-fns';

export default function Documents() {
  const { userData } = useAuth();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingReport, setEditingReport] = useState<any>(null);
  const [reportText, setReportText] = useState('');
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

  const handleEditReport = (document: any) => {
    setEditingReport(document);
    setReportText(document.data);
  };

  const handleSaveReport = async () => {
    if (!editingReport) return;
    try {
      await updateDoc(doc(db, 'documents', editingReport.id), {
        data: reportText,
        size: reportText.length,
        updatedAt: serverTimestamp()
      });
      // Also update student document for backward compatibility
      if (editingReport.studentId) {
        await updateDoc(doc(db, 'students', editingReport.studentId), {
          report: reportText
        });
      }
      toast.success('Relatório atualizado com sucesso!');
      setEditingReport(null);
      setReportText('');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar relatório.');
    }
  };

  const handlePrintReport = (document: any) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const dateStr = document.updatedAt 
        ? format(document.updatedAt.toDate(), 'dd/MM/yyyy') 
        : (document.createdAt ? format(document.createdAt.toDate(), 'dd/MM/yyyy') : '');
        
      printWindow.document.write(`
        <html>
          <head>
            <title>${document.name}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; color: #333; }
              h1 { text-align: center; color: #111; margin-bottom: 20px; }
              .date { text-align: right; color: #666; font-size: 0.9em; margin-bottom: 30px; }
              .content { margin-top: 30px; white-space: pre-wrap; font-size: 1.1em; }
              .signature { margin-top: 80px; text-align: center; }
              .signature p { margin: 5px 0; }
              .line { display: inline-block; width: 300px; border-top: 1px solid #000; margin-bottom: 10px; }
            </style>
          </head>
          <body>
            <h1>${document.name}</h1>
            <div class="date">Data: ${dateStr}</div>
            <div class="content">${document.data}</div>
            <div class="signature">
              <div class="line"></div>
              <p>Assinado por: <strong>${document.authorName || 'Professor'}</strong></p>
            </div>
            <script>
              window.onload = () => { window.print(); window.close(); }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
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
                  {doc.type === 'text/report' ? (
                    <>
                      <button
                        onClick={() => handlePrintReport(doc)}
                        className="text-indigo-600 hover:text-indigo-900 mr-4 inline-flex items-center"
                        title="Imprimir"
                      >
                        <Printer className="h-4 w-4 mr-1" />
                        Imprimir
                      </button>
                      {(userData?.role === 'admin' || userData?.uid === doc.uploadedBy) && (
                        <button
                          onClick={() => handleEditReport(doc)}
                          className="text-blue-600 hover:text-blue-900 mr-4 inline-flex items-center"
                          title="Editar"
                        >
                          <Edit2 className="h-4 w-4 mr-1" />
                          Editar
                        </button>
                      )}
                    </>
                  ) : (
                    <a
                      href={doc.data}
                      download={doc.name}
                      className="text-indigo-600 hover:text-indigo-900 mr-4 inline-flex items-center"
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Baixar
                    </a>
                  )}
                  {(userData?.role === 'admin' || userData?.uid === doc.uploadedBy) && (
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Excluir"
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

      {editingReport && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Editar Relatório</h3>
              <button onClick={() => setEditingReport(null)} className="text-gray-400 hover:text-gray-500">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="mb-4">
              <textarea
                rows={10}
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder="Escreva o relatório aqui..."
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setEditingReport(null)}
                className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveReport}
                className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
