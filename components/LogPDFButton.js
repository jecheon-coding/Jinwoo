import { PDFDownloadLink } from '@react-pdf/renderer';
import LogDocument from './LogDocument';

export default function LogPDFButton({ date, record, presentWorkers, settings }) {
  return (
    <PDFDownloadLink
      document={<LogDocument date={date} record={record} presentWorkers={presentWorkers} settings={settings} />}
      fileName={`운행일지_${date}.pdf`}
      style={{
        background: '#2563eb', color: '#fff', border: '1px solid #2563eb',
        padding: '6px 14px', borderRadius: '5px', fontSize: '13px',
        textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
        cursor: 'pointer', whiteSpace: 'nowrap', height: '34px', boxSizing: 'border-box', lineHeight: '1.2',
      }}
    >
      {({ loading }) => loading ? 'PDF 생성 중...' : 'PDF 저장'}
    </PDFDownloadLink>
  );
}
