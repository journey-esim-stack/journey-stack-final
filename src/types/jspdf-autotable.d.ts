declare module 'jspdf-autotable' {
  import { jsPDF } from 'jspdf';
  
  interface AutoTableOptions {
    head?: any[][];
    body?: any[][];
    startY?: number;
    styles?: any;
    headStyles?: any;
    bodyStyles?: any;
    alternateRowStyles?: any;
    columnStyles?: any;
    margin?: any;
    tableWidth?: any;
    showHead?: boolean;
    showFoot?: boolean;
    pageBreak?: string;
    rowPageBreak?: string;
    tableLineColor?: any;
    tableLineWidth?: number;
  }
  
  function autoTable(doc: jsPDF, options: AutoTableOptions): void;
  
  export default autoTable;
}