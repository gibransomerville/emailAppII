/**
 * Simple PDF.js Loader
 * Alternative approach using script tags for better Electron compatibility
 * 
 * @author Email App Modular Architecture
 * @version 1.0.0
 */

interface SimplePDFJS {
    getDocument: (src: string | ArrayBuffer | Uint8Array) => any;
    GlobalWorkerOptions: {
        workerSrc: string;
    };
    version?: string;
}

/**
 * Simple PDF.js loader that works reliably in Electron
 */
export class PDFJSLoader {
    private static instance: PDFJSLoader;
    private pdfjs: SimplePDFJS | null = null;
    private isLoaded = false;
    private loadPromise: Promise<SimplePDFJS> | null = null;

    static getInstance(): PDFJSLoader {
        if (!PDFJSLoader.instance) {
            PDFJSLoader.instance = new PDFJSLoader();
        }
        return PDFJSLoader.instance;
    }

    /**
     * Load PDF.js library using script tags (more reliable in Electron)
     */
    async loadPDFJS(): Promise<SimplePDFJS> {
        if (this.isLoaded && this.pdfjs) {
            return this.pdfjs;
        }

        if (this.loadPromise) {
            return this.loadPromise;
        }

        this.loadPromise = new Promise<SimplePDFJS>(async (resolve, reject) => {
            try {
                // First try: Check if PDF.js is already globally available
                if ((window as any).pdfjsLib && (window as any).pdfjsLib.getDocument) {
                    console.log('[PDFJSLoader] PDF.js already available globally');
                    this.pdfjs = (window as any).pdfjsLib;
                    this.isLoaded = true;
                    resolve(this.pdfjs!);
                    return;
                }

                console.log('[PDFJSLoader] Loading PDF.js...');

                // Create and load PDF.js script
                const script = document.createElement('script');
                script.type = 'text/javascript';
                script.async = true;
                
                // Try local file first, then CDN
                const scriptSources = [
                    './js/pdf.min.mjs',
                    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.min.mjs'
                ];

                let scriptLoaded = false;

                for (const src of scriptSources) {
                    try {
                        console.log(`[PDFJSLoader] Trying to load from: ${src}`);
                        
                        await new Promise<void>((scriptResolve, scriptReject) => {
                            script.onload = () => {
                                console.log(`[PDFJSLoader] Script loaded from: ${src}`);
                                scriptLoaded = true;
                                scriptResolve();
                            };
                            
                            script.onerror = () => {
                                console.warn(`[PDFJSLoader] Failed to load from: ${src}`);
                                scriptReject(new Error(`Failed to load script from ${src}`));
                            };
                            
                            script.src = src;
                            document.head.appendChild(script);
                            
                            // Timeout after 10 seconds
                            setTimeout(() => {
                                if (!scriptLoaded) {
                                    scriptReject(new Error(`Timeout loading ${src}`));
                                }
                            }, 10000);
                        });

                        if (scriptLoaded) {
                            break;
                        }
                    } catch (error) {
                        console.warn(`[PDFJSLoader] Error loading from ${src}:`, error);
                        continue;
                    }
                }

                if (!scriptLoaded) {
                    throw new Error('Failed to load PDF.js from any source');
                }

                // Wait for PDF.js to be available
                let attempts = 0;
                const maxAttempts = 50; // 5 seconds total
                
                while (attempts < maxAttempts) {
                    if ((window as any).pdfjsLib && (window as any).pdfjsLib.getDocument) {
                        console.log('[PDFJSLoader] PDF.js is now available');
                        this.pdfjs = (window as any).pdfjsLib;
                        break;
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 100));
                    attempts++;
                }

                if (!this.pdfjs) {
                    throw new Error('PDF.js library not available after loading script');
                }

                // Set up worker
                await this.setupWorker();

                this.isLoaded = true;
                console.log('[PDFJSLoader] PDF.js loaded successfully');
                resolve(this.pdfjs);

            } catch (error) {
                console.error('[PDFJSLoader] Error loading PDF.js:', error);
                reject(error);
            }
        });

        return this.loadPromise;
    }

    /**
     * Set up PDF.js worker
     */
    private async setupWorker(): Promise<void> {
        if (!this.pdfjs) {
            throw new Error('PDF.js not loaded');
        }

        const workerPaths = [
            './js/pdf.worker.min.mjs',
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs'
        ];

        for (const workerPath of workerPaths) {
            try {
                console.log(`[PDFJSLoader] Testing worker path: ${workerPath}`);
                
                // Test if worker file is accessible
                const response = await fetch(workerPath, { method: 'HEAD' });
                
                if (response.ok) {
                    console.log(`[PDFJSLoader] Using worker: ${workerPath}`);
                    this.pdfjs.GlobalWorkerOptions.workerSrc = workerPath;
                    return;
                }
            } catch (error) {
                console.warn(`[PDFJSLoader] Worker path ${workerPath} not available:`, error);
            }
        }

        throw new Error('No PDF.js worker available');
    }

    /**
     * Create PDF document from data
     */
    async createPDFDocument(data: ArrayBuffer | Uint8Array | string): Promise<any> {
        const pdfjs = await this.loadPDFJS();
        
        try {
            console.log('[PDFJSLoader] Creating PDF document...');
            const loadingTask = pdfjs.getDocument(data);
            const pdfDocument = await loadingTask.promise;
            console.log(`[PDFJSLoader] PDF document loaded with ${pdfDocument.numPages} pages`);
            return pdfDocument;
        } catch (error) {
            console.error('[PDFJSLoader] Error creating PDF document:', error);
            throw error;
        }
    }

    /**
     * Simple PDF rendering to canvas
     */
    async renderPDFToCanvas(
        pdfDocument: any, 
        pageNumber: number, 
        canvas: HTMLCanvasElement, 
        scale: number = 1.0
    ): Promise<void> {
        try {
            console.log(`[PDFJSLoader] Rendering page ${pageNumber} at scale ${scale}`);
            
            const page = await pdfDocument.getPage(pageNumber);
            const viewport = page.getViewport({ scale });
            
            const context = canvas.getContext('2d');
            if (!context) {
                throw new Error('Canvas context not available');
            }
            
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            
            await page.render(renderContext).promise;
            console.log(`[PDFJSLoader] Page ${pageNumber} rendered successfully`);
            
        } catch (error) {
            console.error(`[PDFJSLoader] Error rendering page ${pageNumber}:`, error);
            throw error;
        }
    }

    /**
     * Get PDF.js instance (must be loaded first)
     */
    getPDFJS(): SimplePDFJS | null {
        return this.pdfjs;
    }

    /**
     * Check if PDF.js is loaded
     */
    isReady(): boolean {
        return this.isLoaded && this.pdfjs !== null;
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    (window as any).PDFJSLoader = PDFJSLoader;
}

export default PDFJSLoader; 