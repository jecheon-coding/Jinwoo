import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import LogDocument from './LogDocument';

export default function LogViewer({ date, record, presentWorkers, settings }) {
  const docProps = { date, record, presentWorkers, settings };
  const fileName = `운행일지_${date}.pdf`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        display: 'flex', gap: '8px', padding: '10px 14px',
        background: '#f3f4f6', borderBottom: '1px solid #d1d5db',
        alignItems: 'center',
      }}>
        <a href="/history" style={{
          background: '#fff', color: '#374151', border: '1px solid #9ca3af',
          padding: '7px 18px', borderRadius: '6px', fontSize: '13px',
          textDecoration: 'none',
        }}>← 뒤로</a>

        <PDFDownloadLink
          document={<LogDocument {...docProps} />}
          fileName={fileName}
          style={{
            background: '#2563eb', color: '#fff',
            padding: '7px 18px', borderRadius: '6px', fontSize: '13px',
            textDecoration: 'none', cursor: 'pointer',
          }}
        >
          {({ loading }) => loading ? '생성 중...' : '⬇ PDF 다운로드'}
        </PDFDownloadLink>
      </div>

      <div style={{ flex: 1 }}>
        <PDFViewer style={{ width: '100%', height: '100%' }}>
          <LogDocument {...docProps} />
        </PDFViewer>
      </div>
    </div>
  );
}
