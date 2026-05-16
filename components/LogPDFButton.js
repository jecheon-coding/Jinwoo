import { PDFDownloadLink } from '@react-pdf/renderer';
import LogDocument from './LogDocument';

export default function LogPDFButton({ date, record, presentWorkers, settings }) {
  return (
    <PDFDownloadLink
      document={<LogDocument date={date} record={record} presentWorkers={presentWorkers} settings={settings} />}
      fileName={`운행일지_${date}.pdf`}
      style={{
        background: '#2563eb', color: '#fff', border: 'none',
        padding: '7px 18px', borderRadius: '6px', fontSize: '13px',
        textDecoration: 'none', display: 'inline-block', cursor: 'pointer',
      }}
    >
      {({ loading }) => loading ? '⏳ PDF 생성 중...' : '⬇ PDF 저장'}
    </PDFDownloadLink>
  );
}
