// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

interface OCRResult {
  pageNum: number;
  imageUrl: string;
  text: string;
  words: {
    text: string;
    bbox: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };
    confidence: number;
  }[];
  dimensions: {
    width: number;
    height: number;
  };
}

class PDFOCRTool {
  private pdfDocument: any;
  private ocrResults: OCRResult[] = [];
  private elements: {
    dropZone: HTMLElement;
    fileInput: HTMLInputElement;
    progressContainer: HTMLElement;
    progressBar: HTMLElement;
    progressText: HTMLElement;
    resultContainer: HTMLElement;
    pagesContainer: HTMLElement;
    downloadBtn: HTMLElement;
    downloadPdfBtn: HTMLElement;
    downloadTxtBtn: HTMLElement;
    newFileBtn: HTMLElement;
  };

  constructor() {
    this.initializeElements();
    this.setupEventListeners();
  }

  private initializeElements() {
    this.elements = {
      dropZone: document.getElementById('dropZone')!,
      fileInput: document.getElementById('fileInput') as HTMLInputElement,
      progressContainer: document.getElementById('progressContainer')!,
      progressBar: document.getElementById('progressBar')!,
      progressText: document.getElementById('progressText')!,
      resultContainer: document.getElementById('resultContainer')!,
      pagesContainer: document.getElementById('pagesContainer')!,
      downloadBtn: document.getElementById('downloadBtn')!,
      downloadPdfBtn: document.getElementById('downloadPdfBtn')!,
      downloadTxtBtn: document.getElementById('downloadTxtBtn')!,
      newFileBtn: document.getElementById('newFileBtn')!
    };
  }

  private setupEventListeners() {
    // Drop zone events
    this.elements.dropZone.addEventListener('click', () => this.elements.fileInput.click());
    this.elements.dropZone.addEventListener('dragover', this.handleDragOver.bind(this));
    this.elements.dropZone.addEventListener('dragleave', this.handleDragLeave.bind(this));
    this.elements.dropZone.addEventListener('drop', this.handleDrop.bind(this));

    // File input change event
    this.elements.fileInput.addEventListener('change', this.handleFileSelect.bind(this));

    // Button events
    this.elements.downloadBtn.addEventListener('click', () => this.downloadTextResults());
    this.elements.downloadPdfBtn.addEventListener('click', () => this.downloadSearchablePDF());
    this.elements.downloadTxtBtn.addEventListener('click', () => this.downloadTextResults());
    this.elements.newFileBtn.addEventListener('click', () => this.reset());
  }

  private handleDragOver(e: DragEvent) {
    e.preventDefault();
    this.elements.dropZone.classList.add('drag-over');
  }

  private handleDragLeave() {
    this.elements.dropZone.classList.remove('drag-over');
  }

  private handleDrop(e: DragEvent) {
    e.preventDefault();
    this.elements.dropZone.classList.remove('drag-over');
    const file = e.dataTransfer?.files[0];
    if (file?.type === 'application/pdf') {
      this.processPDF(file);
    } else {
      alert('Please drop a PDF file');
    }
  }

  private handleFileSelect(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.processPDF(file);
  }

  private async processPDF(file: File) {
    try {
      this.showProgress();
      const arrayBuffer = await file.arrayBuffer();
      this.pdfDocument = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      const totalPages = this.pdfDocument.numPages;
      this.ocrResults = [];

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        await this.processPage(pageNum, totalPages);
      }

      this.showResults();
    } catch (error) {
      console.error('Error processing PDF:', error);
      alert('Error processing PDF. Please try again.');
      this.reset();
    }
  }

  private async processPage(pageNum: number, totalPages: number) {
    this.updateProgress((pageNum - 1) / totalPages * 100);
    this.elements.progressText.textContent = `Processing page ${pageNum} of ${totalPages}...`;

    const page = await this.pdfDocument.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext('2d')!;

    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    // Configure Tesseract with better options
    const result = await Tesseract.recognize(canvas, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          this.updateProgress((pageNum - 1 + m.progress) / totalPages * 100);
        }
      },
      psm: 4, // PSM_SINGLE_COLUMN for better alignment
      tessedit_pageseg_mode: '4',
      preserve_interword_spaces: '1',
      textord_heavy_nr: '1',
      tessedit_create_hocr: '1' // Enable hOCR output
    });

    this.ocrResults.push({
      pageNum,
      imageUrl: canvas.toDataURL(),
      text: result.data.text,
      words: result.data.words,
      dimensions: {
        width: canvas.width,
        height: canvas.height
      }
    });
  }

  private async downloadSearchablePDF() {
    const { PDFDocument, rgb, PageSizes } = await import('https://cdn.skypack.dev/pdf-lib');
    const pdfDoc = await PDFDocument.create();

    for (const result of this.ocrResults) {
      // Create page with same dimensions as source
      const page = pdfDoc.addPage([result.dimensions.width, result.dimensions.height]);
      
      // Add image maintaining exact dimensions
      const img = await pdfDoc.embedPng(result.imageUrl);
      page.drawImage(img, {
        x: 0,
        y: 0,
        width: result.dimensions.width,
        height: result.dimensions.height
      });

      // Add text layer with precise positioning
      for (const word of result.words) {
        if (word.confidence > 75) { // Increased confidence threshold
          const { bbox } = word;
          
          // Calculate font metrics
          const fontSize = bbox.y1 - bbox.y0;
          const fontWidth = bbox.x1 - bbox.x0;
          const aspectRatio = fontWidth / fontSize;
          
          // Adjust position based on text metrics
          const x = bbox.x0;
          const y = result.dimensions.height - bbox.y1; // Flip Y coordinate
          
          try {
            const font = await pdfDoc.embedFont('Helvetica');
            const textWidth = font.widthOfTextAtSize(word.text, fontSize);
            const scaleFactor = fontWidth / textWidth;
            
            page.drawText(word.text, {
              x,
              y,
              size: fontSize,
              font,
              color: rgb(0, 0, 0),
              opacity: 0,
              scale: scaleFactor // Scale text to match original width
            });
          } catch (error) {
            console.warn(`Failed to render word: ${word.text}`, error);
          }
        }
      }
    }

    // Use better PDF compression and settings
    const pdfBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
      preservePDFForm: true
    });

    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'searchable.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private downloadTextResults() {
    const text = this.ocrResults.map(result => 
      `Page ${result.pageNum}\n${result.text}\n\n`
    ).join('---\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ocr-results.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private showProgress() {
    this.elements.dropZone.hidden = true;
    this.elements.progressContainer.hidden = false;
    this.elements.resultContainer.hidden = true;
  }

  private updateProgress(percentage: number) {
    this.elements.progressBar.style.width = `${percentage}%`;
  }

  private showResults() {
    this.elements.progressContainer.hidden = true;
    this.elements.resultContainer.hidden = false;
    this.renderResults();
  }

  private renderResults() {
    this.elements.pagesContainer.innerHTML = '';
    this.ocrResults.forEach(result => {
      const pageWrapper = document.createElement('div');
      pageWrapper.className = 'page-wrapper';
      
      const img = document.createElement('img');
      img.src = result.imageUrl;
      img.className = 'page-image';
      img.alt = `Page ${result.pageNum}`;

      const textDiv = document.createElement('div');
      textDiv.className = 'page-text';
      textDiv.textContent = result.text;

      pageWrapper.appendChild(img);
      pageWrapper.appendChild(textDiv);
      this.elements.pagesContainer.appendChild(pageWrapper);
    });
  }

  private reset() {
    this.elements.dropZone.hidden = false;
    this.elements.progressContainer.hidden = true;
    this.elements.resultContainer.hidden = true;
    this.elements.fileInput.value = '';
    this.pdfDocument = null;
    this.ocrResults = [];
    this.elements.progressBar.style.width = '0%';
  }
}

// Initialize the tool when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new PDFOCRTool();
}); 