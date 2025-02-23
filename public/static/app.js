// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

class PDFOCRTool {
    constructor() {
        this.initializeElements();
        this.setupEventListeners();
        this.pdfDocument = null;
        this.ocrResults = [];
    }

    initializeElements() {
        this.dropZone = document.getElementById('dropZone');
        this.fileInput = document.getElementById('fileInput');
        this.progressContainer = document.getElementById('progressContainer');
        this.progressBar = document.getElementById('progressBar');
        this.progressText = document.getElementById('progressText');
        this.resultContainer = document.getElementById('resultContainer');
        this.pagesContainer = document.getElementById('pagesContainer');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.newFileBtn = document.getElementById('newFileBtn');
    }

    setupEventListeners() {
        // Drop zone events
        this.dropZone.addEventListener('click', () => this.fileInput.click());
        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('drag-over');
        });
        this.dropZone.addEventListener('dragleave', () => {
            this.dropZone.classList.remove('drag-over');
        });
        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file?.type === 'application/pdf') {
                this.processPDF(file);
            } else {
                alert('Please drop a PDF file');
            }
        });

        // File input change event
        this.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.processPDF(file);
        });

        // Button events
        this.downloadBtn.addEventListener('click', () => this.downloadResults());
        this.newFileBtn.addEventListener('click', () => this.reset());
    }

    async processPDF(file) {
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

    async processPage(pageNum, totalPages) {
        // Update progress
        this.updateProgress((pageNum - 1) / totalPages * 100);
        this.progressText.textContent = `Processing page ${pageNum} of ${totalPages}...`;

        // Get PDF page
        const page = await this.pdfDocument.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 });

        // Create canvas and render PDF page
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext('2d');

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        // Perform OCR
        const result = await Tesseract.recognize(canvas, 'eng', {
            logger: (m) => {
                if (m.status === 'recognizing text') {
                    this.updateProgress((pageNum - 1 + m.progress) / totalPages * 100);
                }
            }
        });

        this.ocrResults.push({
            pageNum,
            imageUrl: canvas.toDataURL(),
            text: result.data.text
        });
    }

    showProgress() {
        this.dropZone.hidden = true;
        this.progressContainer.hidden = false;
        this.resultContainer.hidden = true;
    }

    updateProgress(percentage) {
        this.progressBar.style.width = `${percentage}%`;
    }

    showResults() {
        this.progressContainer.hidden = true;
        this.resultContainer.hidden = false;
        this.renderResults();
    }

    renderResults() {
        this.pagesContainer.innerHTML = '';
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
            this.pagesContainer.appendChild(pageWrapper);
        });
    }

    downloadResults() {
        const text = this.ocrResults.map(result => 
            `Page ${result.pageNum}
${result.text}

`
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

    reset() {
        this.dropZone.hidden = false;
        this.progressContainer.hidden = true;
        this.resultContainer.hidden = true;
        this.fileInput.value = '';
        this.pdfDocument = null;
        this.ocrResults = [];
        this.progressBar.style.width = '0%';
    }
}

// Initialize the tool when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new PDFOCRTool();
});