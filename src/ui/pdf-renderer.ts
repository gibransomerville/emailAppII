/**
 * PDF Renderer Module
 * Handles PDF rendering using PDF.js v4.x with Electron compatibility
 * 
 * Features:
 * - Electron-compatible PDF.js integration
 * - Comprehensive mobile-responsive viewer controls
 * - Advanced zoom controls with multiple options
 * - Full text search with highlighting
 * - Touch gesture support for mobile devices
 * - Keyboard shortcuts and accessibility
 * - Error handling for loading failures
 * - Memory management and cleanup
 * 
 * @author Email App Modular Architecture
 * @version 2.0.0
 */

import { Attachment } from '../../types/email.js';

// PDF.js interfaces (will be loaded dynamically)
interface PDFDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPageProxy>;
    destroy(): void;
}

interface PDFPageProxy {
    getViewport(params: { scale: number }): PDFPageViewport;
    render(params: { canvasContext: CanvasRenderingContext2D; viewport: PDFPageViewport }): PDFRenderTask;
    getTextContent(): Promise<any>;
    destroy(): void;
}

interface PDFPageViewport {
    width: number;
    height: number;
    transform: number[];
}

interface PDFRenderTask {
    promise: Promise<void>;
    cancel(): void;
}

interface PDFJSStatic {
    getDocument(src: string | ArrayBuffer | Uint8Array): any;
    GlobalWorkerOptions: {
        workerSrc: string;
    };
    version: string;
}

/**
 * PDF Renderer Configuration
 */
interface PDFRendererConfig {
    defaultScale: number;
    maxScale: number;
    minScale: number;
    scaleStep: number;
    dpiMultiplier: number; // Higher values = sharper rendering (1.0 = 72 DPI, 2.0 = 144 DPI, 3.0 = 216 DPI)
    enableSearch: boolean;
    enableNavigation: boolean;
    enableZoom: boolean;
    enableFullscreen: boolean;
    enableTouch: boolean;
    renderTimeout: number;
    maxCanvasSize: number;
    searchCaseSensitive: boolean;
    mobileBreakpoint: number;
}

/**
 * PDF Renderer State
 */
interface PDFRendererState {
    isLoading: boolean;
    isInitialized: boolean;
    currentPage: number;
    totalPages: number;
    scale: number;
    rotation: number;
    error: string | null;
    searchTerm: string;
    searchResults: SearchResult[];
    currentSearchIndex: number;
    isFullscreen: boolean;
    isMobile: boolean;
    touchStartTime: number;
    lastTouchX: number;
    lastTouchY: number;
}

/**
 * Search Result Interface
 */
interface SearchResult {
    pageNumber: number;
    textIndex: number;
    text: string;
    coordinates: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

/**
 * Zoom Preset Interface
 */
interface ZoomPreset {
    label: string;
    value: number | string;
    icon?: string;
}

/**
 * PDF Renderer Class
 */
class PDFRenderer {
    private static instance: PDFRenderer;
    private pdfjs: PDFJSStatic | null = null;
    private isInitialized = false;
    private currentDocument: PDFDocumentProxy | null = null;
    private currentRenderTask: PDFRenderTask | null = null;
    private pageTextContent: Map<number, any> = new Map();
    private config: PDFRendererConfig;
    private state: PDFRendererState;
    private eventListeners: Map<string, EventListener[]> = new Map();
    private resizeObserver: ResizeObserver | null = null;
    private pageCache: Map<number, ImageBitmap> = new Map();
    private maxCacheSize = 5; // Cache up to 5 pages
    private container: HTMLElement | null = null;
    private isInitialRender = true; // Track if this is the first render

    // Zoom presets for dropdown
    private readonly zoomPresets: ZoomPreset[] = [
        { label: 'Fit Width', value: 'fit-width', icon: 'fas fa-arrows-alt-h' },
        { label: 'Fit Page', value: 'fit-page', icon: 'fas fa-expand-arrows-alt' },
        { label: 'Actual Size', value: 1.0, icon: 'fas fa-search' },
        { label: '50%', value: 0.5 },
        { label: '75%', value: 0.75 },
        { label: '100%', value: 1.0 },
        { label: '125%', value: 1.25 },
        { label: '150%', value: 1.5 },
        { label: '200%', value: 2.0 },
        { label: '300%', value: 3.0 },
        { label: '400%', value: 4.0 }
    ];

    constructor(config: Partial<PDFRendererConfig> = {}) {
        this.config = {
            defaultScale: 1.0, // ← Use actual size, let CSS handle fitting
            maxScale: 4.0,
            minScale: 0.3,
            scaleStep: 0.25,
            dpiMultiplier: 2.0, // ← 2x DPI = 144 DPI for sharper rendering
            enableSearch: true,
            enableNavigation: true,
            enableZoom: true,
            enableFullscreen: true,
            enableTouch: true,
            renderTimeout: 10000,
            maxCanvasSize: 67108864,
            searchCaseSensitive: false,
            mobileBreakpoint: 768,
            ...config
        };

        this.state = {
            isLoading: false,
            isInitialized: false,
            currentPage: 1,
            totalPages: 0,
            scale: this.config.defaultScale,
            rotation: 0,
            error: null,
            searchTerm: '',
            searchResults: [],
            currentSearchIndex: -1,
            isFullscreen: false,
            isMobile: window.innerWidth <= this.config.mobileBreakpoint,
            touchStartTime: 0,
            lastTouchX: 0,
            lastTouchY: 0
        };

        this.setupResponsiveDetection();
    }

    /**
     * Get singleton instance
     */
    static getInstance(config?: Partial<PDFRendererConfig>): PDFRenderer {
        if (!PDFRenderer.instance) {
            PDFRenderer.instance = new PDFRenderer(config);
        }
        return PDFRenderer.instance;
    }

    /**
     * Enhanced responsive detection with ResizeObserver
     */
    private setupResponsiveDetection(): void {
        window.addEventListener('resize', () => {
            this.state.isMobile = window.innerWidth <= this.config.mobileBreakpoint;
            this.updateResponsiveLayout();
        });

        // Set up ResizeObserver for container size changes
        if ('ResizeObserver' in window) {
            this.resizeObserver = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    if (entry.target.classList.contains('pdf-viewer-content')) {
                        this.handleContainerResize();
                    }
                }
            });
        }
    }

    /**
     * Update responsive layout
     */
    private updateResponsiveLayout(): void {
        if (!this.container) return;

        const header = this.container.querySelector('.pdf-viewer-header') as HTMLElement;
        if (header) {
            if (this.state.isMobile) {
                header.style.flexDirection = 'column';
                header.style.gap = '8px';
                header.style.padding = '12px';
            } else {
                header.style.flexDirection = 'row';
                header.style.gap = '';
                header.style.padding = '8px 16px';
            }
        }

        this.updateMobileControls();
    }

    /**
     * Update mobile control visibility
     */
    private updateMobileControls(): void {
        if (!this.container) return;

        const controls = this.container.querySelectorAll('.pdf-control-group');
        controls.forEach(control => {
            const element = control as HTMLElement;
            if (this.state.isMobile) {
                element.classList.add('mobile-controls');
            } else {
                element.classList.remove('mobile-controls');
            }
        });
    }

    /**
     * Handle container resize events
     */
    private async handleContainerResize(): Promise<void> {
        if (!this.container) return;
        
        const pagesContainer = this.container.querySelector('.pdf-pages-container') as HTMLElement;
        
        if (pagesContainer) {
            await this.applyCSSBasedFitting(pagesContainer);
        }
    }

    /**
     * Apply CSS-based fitting using actual PDF page dimensions
     */
    private async applyCSSBasedFitting(container: HTMLElement): Promise<void> {
        const contentArea = this.container?.querySelector('.pdf-viewer-content') as HTMLElement;
        if (!contentArea || !this.currentDocument) return;

        const PADDING = 16; // Minimal padding
        const PAGE_GAP = 8; // Minimal gap between pages
        
        // Get available space
        const availableWidth = contentArea.clientWidth - PADDING;
        
        try {
            // Get ACTUAL PDF page dimensions from first page
            const page = await this.currentDocument.getPage(1);
            const viewport = page.getViewport({ scale: 1.0 });
            const actualPDFAspectRatio = viewport.width / viewport.height;
            
            // Calculate optimal page width based on available space (responsive to modal size)
            const containerWidth = Math.min(availableWidth, availableWidth * 0.9); // Use most of available space
            const containerHeight = containerWidth / actualPDFAspectRatio;
            
            // Set container dimensions for continuous scroll (minimal spacing)
            container.style.width = `${containerWidth}px`;
            container.style.maxWidth = `${containerWidth}px`;
            container.style.margin = '0';
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.gap = `${PAGE_GAP}px`;
            container.style.padding = '0';
            
            // Update all page containers and canvases
            const pageContainers = container.querySelectorAll('.pdf-page-container');
            pageContainers.forEach((pageContainer, index) => {
                const containerElement = pageContainer as HTMLElement;
                const canvas = containerElement.querySelector('.pdf-page-canvas') as HTMLCanvasElement;
                
                if (canvas) {
                    // Get canvas dimensions and DPI info
                    const dpiMultiplier = (canvas as any).__dpiMultiplier || 1.0;
                    const naturalWidth = (canvas as any).__naturalWidth || canvas.width;
                    const naturalHeight = (canvas as any).__naturalHeight || canvas.height;
                    
                    // Calculate base scale using natural (display) dimensions, not high-res canvas dimensions
                    const baseScaleX = containerWidth / naturalWidth;
                    const baseScaleY = containerHeight / naturalHeight;
                    const baseScale = Math.min(baseScaleX, baseScaleY, 1.0);
                    
                    // Calculate final scale: compensate for DPI multiplier and apply user zoom
                    const dpiCompensation = 1.0 / dpiMultiplier;
                    const finalScale = baseScale * this.state.scale * dpiCompensation;
                    
                    // Set container to fixed size with minimal styling
                    containerElement.style.width = `${containerWidth}px`;
                    containerElement.style.height = `${containerHeight}px`;
                    containerElement.style.display = 'flex';
                    containerElement.style.justifyContent = 'center';
                    containerElement.style.alignItems = 'center';
                    containerElement.style.background = 'white';
                    containerElement.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                    containerElement.style.borderRadius = '4px';
                    containerElement.style.overflow = 'hidden'; // Prevent scrolling artifacts
                    containerElement.style.position = 'relative';
                    containerElement.style.margin = '0';
                    containerElement.style.padding = '0';
                    containerElement.style.flexShrink = '0'; // Prevent flex shrinking
                    
                    // Apply zoom with DPI compensation to the canvas content
                    canvas.style.transform = `scale(${finalScale})`;
                    canvas.style.transformOrigin = 'center center';
                    canvas.style.display = 'block';
                    canvas.style.borderRadius = '2px';
                    canvas.style.background = 'white';
                    canvas.style.margin = '0';
                    canvas.style.padding = '0';
                    
                    // Store base scale for zoom calculations
                    (containerElement as any).__baseScale = baseScale;
                    (containerElement as any).__dpiCompensation = dpiCompensation;
                }
            });
            
            // Center the container within the content area (minimal styling)
            contentArea.style.display = 'flex';
            contentArea.style.justifyContent = 'center';
            contentArea.style.alignItems = 'flex-start';
            contentArea.style.padding = '0';
            contentArea.style.margin = '0';
            contentArea.style.overflowY = 'auto'; // Enable vertical scrolling
            contentArea.style.overflowX = 'hidden';
            contentArea.style.minHeight = '0'; // Prevent flex expansion
            
            this.debugLog('CSS fitting applied using actual PDF dimensions', {
                availableWidth,
                containerWidth,
                containerHeight,
                pageCount: pageContainers.length,
                actualPDFAspectRatio,
                pageGap: PAGE_GAP,
                userScale: this.state.scale,
                pdfDimensions: { width: viewport.width, height: viewport.height },
                containerPadding: container.style.padding,
                contentAreaPadding: contentArea.style.padding,
                pagesContainerPadding: container.style.padding
            });
            
        } catch (error) {
            this.debugLog('Error in CSS fitting with PDF dimensions', { error: (error as Error).message });
        }
    }

    /**
     * Initialize PDF.js (only in renderer process)
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            // Load PDF.js from static file to avoid module resolution issues in Electron
            let pdfjsLib: any;
            
            try {
                // Try dynamic import first (works in some Electron setups)
                pdfjsLib = await import('pdfjs-dist');
                this.debugLog('PDF.js loaded via dynamic import');
            } catch (importError) {
                // Fallback to loading from static file
                this.debugLog('Dynamic import failed, loading from static file', { error: (importError as Error).message });
                
                // Load PDF.js from static file
                const script = document.createElement('script');
                script.type = 'module';
                script.textContent = `
                    import * as pdfjsLib from './js/pdf.min.mjs';
                    window.pdfjsLib = pdfjsLib;
                `;
                
                document.head.appendChild(script);
                
                // Wait for script to load
                await new Promise<void>((resolve, reject) => {
                    const checkInterval = setInterval(() => {
                        if ((window as any).pdfjsLib) {
                            clearInterval(checkInterval);
                            clearTimeout(timeout);
                            resolve();
                        }
                    }, 100);
                    
                    const timeout = setTimeout(() => {
                        clearInterval(checkInterval);
                        reject(new Error('Timeout loading PDF.js from static file'));
                    }, 10000);
                });
                
                pdfjsLib = (window as any).pdfjsLib;
                document.head.removeChild(script);
            }
            
            if (!pdfjsLib || !pdfjsLib.getDocument) {
                throw new Error('PDF.js library not properly loaded');
            }
            
            // Try multiple worker paths with fallback
            let workerPath: string;
            
            // First try local worker file
            try {
                workerPath = './js/pdf.worker.min.mjs';
                // Test if worker file exists
                const testResponse = await fetch(workerPath, { method: 'HEAD' });
                if (!testResponse.ok) {
                    throw new Error(`Worker file not found at ${workerPath}`);
                }
                this.debugLog('Using local worker file', { workerPath });
            } catch (localError) {
                // Fallback to CDN worker
                const version = pdfjsLib.version || '4.8.69';
                workerPath = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;
                this.debugLog('Falling back to CDN worker', { workerPath, localError: (localError as Error).message });
            }
            
            pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;

            this.pdfjs = pdfjsLib;
            this.isInitialized = true;
            this.state.isInitialized = true;

            this.debugLog('PDF.js initialized successfully', {
                version: pdfjsLib.version || 'unknown',
                workerSrc: workerPath,
                loadMethod: (window as any).pdfjsLib ? 'static file' : 'dynamic import'
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.state.error = `Failed to initialize PDF.js: ${errorMessage}`;
            this.debugLog('PDF.js initialization failed', { 
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined 
            });
            throw new Error(this.state.error);
        }
    }

    /**
     * Create PDF viewer element
     */
    async createPDFViewer(attachment: Attachment, container: HTMLElement): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        if (!this.pdfjs) {
            throw new Error('PDF.js not initialized');
        }

        // Clear existing content
        container.innerHTML = '';
        this.cleanup();
        
        // Reset initial render flag for new PDF
        this.isInitialRender = true;

        // Create viewer structure
        this.container = container; // Store container reference
        const viewerContainer = this.createViewerContainer();
        container.appendChild(viewerContainer);

        // Set up keyboard and touch event listeners
        this.setupEventListeners(viewerContainer);

        try {
            // Show loading state
            this.showLoadingState(viewerContainer);

            // Load PDF document
            const pdfData = await this.getPDFData(attachment);
            const loadingTask = this.pdfjs.getDocument(pdfData);
            
            // Set loading timeout
            const timeoutId = setTimeout(() => {
                loadingTask.cancel();
                this.state.error = 'PDF loading timed out';
            }, this.config.renderTimeout);

            const pdfDocument = await loadingTask.promise;
            clearTimeout(timeoutId);

            this.currentDocument = pdfDocument;
            this.state.totalPages = pdfDocument.numPages;
            this.state.currentPage = 1;
            this.state.error = null;

            // Clear the loading state before creating UI
            this.clearLoadingState(viewerContainer);
            
            // Create viewer UI
            this.createViewerUI(viewerContainer, attachment);
            
            // Render all pages for continuous scroll
            await this.renderAllPages();

            this.debugLog('PDF loaded successfully', {
                totalPages: this.state.totalPages,
                filename: attachment.filename
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.state.error = `Failed to load PDF: ${errorMessage}`;
            this.showErrorState(viewerContainer, this.state.error);
            this.debugLog('PDF loading failed', { error: errorMessage });
            throw new Error(this.state.error);
        }
    }

    /**
     * Create ultra-minimal viewer container (content-based sizing)
     */
    private createViewerContainer(): HTMLElement {
        const container = document.createElement('div');
        container.className = 'pdf-viewer-container';
        container.style.cssText = `
            width: 100%;
            height: fit-content;
            display: flex;
            flex-direction: column;
            background: #f8f8f8;
            position: relative;
            overflow: hidden;
            margin: 0;
            padding: 0;
        `;
        return container;
    }

    /**
     * Create viewer UI with continuous scroll support (completely minimal - no white bar artifacts)
     */
    private createViewerUI(container: HTMLElement, attachment: Attachment): void {
        // Clear any existing content in the container
        container.innerHTML = '';
        
        // Ultra-minimal content area with content-based sizing
        const contentArea = document.createElement('div');
        contentArea.className = 'pdf-viewer-content';
        contentArea.style.cssText = `
            overflow-y: auto;
            overflow-x: hidden;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding: 0;
            margin: 0;
            background: #f8f8f8;
            position: relative;
            scroll-behavior: smooth;
            width: 100%;
            height: fit-content;
        `;

        // Ultra-minimal pages container
        const pagesContainer = document.createElement('div');
        pagesContainer.className = 'pdf-pages-container';
        pagesContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 0;
            margin: 0;
            background: #f8f8f8;
            width: 100%;
            box-sizing: border-box;
        `;

        contentArea.appendChild(pagesContainer);

        // Set up ResizeObserver on content area
        if (this.resizeObserver) {
            this.resizeObserver.observe(contentArea);
        }

        // Assemble completely minimal viewer (content area only)
        container.appendChild(contentArea);

        // Add scroll event listener for page tracking
        this.setupScrollTracking(contentArea);

        // Add keyboard shortcuts directly to container
        this.setupMinimalKeyboardShortcuts(container);
    }

    /**
     * Set up minimal keyboard shortcuts for toolbar-free experience
     */
    private setupMinimalKeyboardShortcuts(container: HTMLElement): void {
        container.setAttribute('tabindex', '0'); // Make container focusable
        
        container.addEventListener('keydown', (e: KeyboardEvent) => {
            switch (e.key) {
                case 'Home':
                    e.preventDefault();
                    this.scrollToTop();
                    break;
                case 'End':
                    e.preventDefault();
                    this.scrollToBottom();
                    break;
                case 'PageUp':
                case 'ArrowUp':
                    e.preventDefault();
                    this.scrollByAmount(-200); // Scroll up by 200px
                    break;
                case 'PageDown':
                case 'ArrowDown':
                case ' ':
                    e.preventDefault();
                    this.scrollByAmount(200); // Scroll down by 200px
                    break;
                case '+':
                case '=':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.zoomIn();
                    }
                    break;
                case '-':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.zoomOut();
                    }
                    break;
                case '0':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.resetZoom();
                    }
                    break;
                case 'Escape':
                    // Close modal if available
                    const modal = container.closest('.attachment-preview-modal') as HTMLElement;
                    if (modal) {
                        const closeBtn = modal.querySelector('[aria-label="Close preview"]') as HTMLElement;
                        if (closeBtn) closeBtn.click();
                    }
                    break;
            }
        });

        // Focus container when PDF loads
        setTimeout(() => container.focus(), 100);
    }

    /**
     * Scroll by specific amount with smooth animation
     */
    private scrollByAmount(pixels: number): void {
        const contentArea = this.container?.querySelector('.pdf-viewer-content') as HTMLElement;
        if (contentArea) {
            contentArea.scrollBy({
                top: pixels,
                behavior: 'smooth'
            });
        }
    }



    /**
     * Set up scroll tracking for continuous scroll mode
     */
    private setupScrollTracking(contentArea: HTMLElement): void {
        contentArea.addEventListener('scroll', () => {
            this.updateCurrentPageFromScroll(contentArea);
        });
    }

    /**
     * Update current page indicator based on scroll position
     */
    private updateCurrentPageFromScroll(contentArea: HTMLElement): void {
        const pagesContainer = contentArea.querySelector('.pdf-pages-container') as HTMLElement;
        if (!pagesContainer) return;

        const pageContainers = pagesContainer.querySelectorAll('.pdf-page-container');
        const scrollTop = contentArea.scrollTop;
        const containerTop = pagesContainer.offsetTop;

        // Find which page is most visible
        let currentPage = 1;
        pageContainers.forEach((pageContainer, index) => {
            const element = pageContainer as HTMLElement;
            const pageTop = element.offsetTop - containerTop;
            const pageBottom = pageTop + element.offsetHeight;
            
            if (scrollTop >= pageTop - 100 && scrollTop < pageBottom - 100) {
                currentPage = index + 1;
        }
        });

        if (currentPage !== this.state.currentPage) {
            this.state.currentPage = currentPage;
            this.updateUI();
        }
    }

    /**
     * Scroll to top of document
     */
    private scrollToTop(): void {
        const contentArea = this.container?.querySelector('.pdf-viewer-content') as HTMLElement;
        if (contentArea) {
            contentArea.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    /**
     * Scroll to bottom of document
     */
    private scrollToBottom(): void {
        const contentArea = this.container?.querySelector('.pdf-viewer-content') as HTMLElement;
        if (contentArea) {
            contentArea.scrollTo({ top: contentArea.scrollHeight, behavior: 'smooth' });
        }
        }

    /**
     * Auto-resize modal based on PDF dimensions and orientation (content-based)
     */
    private async autoResizeModalForPDF(): Promise<void> {
        if (!this.currentDocument) return;
        
        try {
            // Get first page to determine PDF dimensions
            const firstPage = await this.currentDocument.getPage(1);
            const viewport = firstPage.getViewport({ scale: 1.0 });
            
            const pdfWidth = viewport.width;
            const pdfHeight = viewport.height;
            const aspectRatio = pdfWidth / pdfHeight;
            
            // Determine orientation
            const orientation: 'portrait' | 'landscape' = aspectRatio > 1.2 ? 'landscape' : 'portrait';
            
            // Call modal resize callback if available
            const modalRef = (window as any).__currentPDFModal;
            if (modalRef && modalRef.resizeModal) {
                modalRef.resizeModal(pdfWidth, pdfHeight, orientation);
                
                this.debugLog('PDF Modal Auto-Resize: Modal resized for PDF dimensions (content-based)', {
                    pdfDimensions: { width: pdfWidth, height: pdfHeight },
                    aspectRatio,
                    orientation,
                    dpiMultiplier: this.config.dpiMultiplier
                });
                
                // Clean up the global reference
                setTimeout(() => {
                    delete (window as any).__currentPDFModal;
                }, 100);
            }
        } catch (error) {
            this.debugLog('PDF Modal Auto-Resize Error: Failed to auto-resize modal', {
                error: (error as Error).message
            });
        }
    }

    /**
     * Render all pages for continuous scroll
     */
    private async renderAllPages(): Promise<void> {
        if (!this.currentDocument) {
            throw new Error('No PDF document loaded');
        }

        const pagesContainer = this.container?.querySelector('.pdf-pages-container') as HTMLElement;
        if (!pagesContainer) {
            throw new Error('Pages container not found');
        }

        // Clear existing content
        pagesContainer.innerHTML = '';

        // Show loading state
        this.showLoadingState(pagesContainer);

        try {
            // Render all pages
            for (let pageNum = 1; pageNum <= this.state.totalPages; pageNum++) {
                await this.renderPageToContinuousScroll(pageNum, pagesContainer);
            }

            // Apply CSS-based fitting after all pages are rendered (using actual PDF dimensions)
            await this.applyCSSBasedFitting(pagesContainer);

            // Auto-resize modal based on PDF dimensions and orientation
            await this.autoResizeModalForPDF();

            // Clear loading state
            this.clearLoadingState(pagesContainer);

            this.debugLog('All pages rendered for continuous scroll', {
                totalPages: this.state.totalPages,
                scale: this.state.scale
            });

        } catch (error) {
            this.clearLoadingState(pagesContainer);
            throw error;
        }
    }

    /**
     * Render a single page to the continuous scroll container
     */
    private async renderPageToContinuousScroll(pageNumber: number, container: HTMLElement): Promise<void> {
        try {
            const page = await this.currentDocument!.getPage(pageNumber);
            
            // Apply DPI multiplier for higher resolution rendering
            let renderScale = this.state.scale * this.config.dpiMultiplier;
            let viewport = page.getViewport({ scale: renderScale });

            // Create minimal page container
            const pageContainer = document.createElement('div');
            pageContainer.className = 'pdf-page-container';
            pageContainer.setAttribute('data-page', pageNumber.toString());
            pageContainer.style.cssText = `
            background: white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-radius: 4px;
            overflow: hidden;
                position: relative;
                display: flex;
                justify-content: center;
                align-items: center;
                margin: 0;
                padding: 0;
                flex-shrink: 0;
        `;

            // Create minimal canvas
        const canvas = document.createElement('canvas');
            canvas.className = 'pdf-page-canvas';
        canvas.style.cssText = `
            display: block;
                width: auto;
            height: auto;
                border-radius: 2px;
                margin: 0;
                padding: 0;
            `;

            // Set canvas dimensions to high-resolution size
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            // Store DPI info for CSS scaling
            (canvas as any).__dpiMultiplier = this.config.dpiMultiplier;
            (canvas as any).__naturalWidth = viewport.width / this.config.dpiMultiplier;
            (canvas as any).__naturalHeight = viewport.height / this.config.dpiMultiplier;

            const context = canvas.getContext('2d');
            if (!context) {
                throw new Error('Failed to get canvas context');
            }

            // Render page at high resolution
            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };

            const renderTask = page.render(renderContext);
            await renderTask.promise;

            pageContainer.appendChild(canvas);
            container.appendChild(pageContainer);

            this.debugLog(`Page ${pageNumber} rendered with ${this.config.dpiMultiplier}x DPI`, {
                pageNumber,
                highResWidth: viewport.width,
                highResHeight: viewport.height,
                displayWidth: viewport.width / this.config.dpiMultiplier,
                displayHeight: viewport.height / this.config.dpiMultiplier,
                dpiMultiplier: this.config.dpiMultiplier
            });

        } catch (error) {
            this.debugLog(`Error rendering page ${pageNumber}`, { error: (error as Error).message });
            throw error;
        }
    }

    /**
     * Set up keyboard and touch event listeners
     */
    private setupEventListeners(container: HTMLElement): void {
        // Keyboard shortcuts
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return;

            switch (e.key) {
                case 'ArrowLeft':
                case 'ArrowUp':
                case 'PageUp':
                    e.preventDefault();
                    this.scrollToTop();
                    break;
                case 'ArrowRight':
                case 'ArrowDown':
                case 'PageDown':
                case ' ':
                    e.preventDefault();
                    this.scrollToBottom();
                    break;
                case 'Home':
                    e.preventDefault();
                    this.scrollToTop();
                    break;
                case 'End':
                    e.preventDefault();
                    this.scrollToBottom();
                    break;
                case '+':
                case '=':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.zoomIn();
                    }
                    break;
                case '-':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.zoomOut();
                    }
                    break;
                case '0':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.setZoom(1.0);
                    }
                    break;
                case 'f':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.toggleFullscreen();
                    }
                    break;
                case 'Escape':
                    if (this.state.isFullscreen) {
                        e.preventDefault();
                        this.exitFullscreen();
                    }
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        // Touch gestures for mobile
        if (this.config.enableTouch) {
            this.setupTouchGestures(container);
        }

        // Mouse wheel zoom
        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                if (e.deltaY < 0) {
                    this.zoomIn();
                } else {
                    this.zoomOut();
                }
            }
        };

        container.addEventListener('wheel', handleWheel, { passive: false });

        // Store event listeners for cleanup
        this.eventListeners.set('keydown', [handleKeyDown as EventListener]);
        this.eventListeners.set('wheel', [handleWheel as EventListener]);
    }

    /**
     * Set up touch gestures
     */
    private setupTouchGestures(container: HTMLElement): void {
        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartDistance = 0;
        let initialScale = this.state.scale;

        const handleTouchStart = (e: TouchEvent) => {
            this.state.touchStartTime = Date.now();

            if (e.touches.length === 1) {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
            } else if (e.touches.length === 2) {
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                touchStartDistance = Math.sqrt(
                    Math.pow(touch2.clientX - touch1.clientX, 2) +
                    Math.pow(touch2.clientY - touch1.clientY, 2)
                );
                initialScale = this.state.scale;
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const currentDistance = Math.sqrt(
                    Math.pow(touch2.clientX - touch1.clientX, 2) +
                    Math.pow(touch2.clientY - touch1.clientY, 2)
                );

                if (touchStartDistance > 0) {
                    const scaleChange = currentDistance / touchStartDistance;
                    const newScale = Math.min(
                        Math.max(initialScale * scaleChange, this.config.minScale),
                        this.config.maxScale
                    );
                    this.setZoom(newScale);
                }
            }
        };

        const handleTouchEnd = (e: TouchEvent) => {
            const touchDuration = Date.now() - this.state.touchStartTime;
            
            if (e.changedTouches.length === 1 && touchDuration < 300) {
                const touchEndX = e.changedTouches[0].clientX;
                const touchEndY = e.changedTouches[0].clientY;
                const deltaX = touchEndX - touchStartX;
                const deltaY = touchEndY - touchStartY;
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

                // Swipe navigation (minimum 50px swipe)
                if (distance > 50) {
                    if (Math.abs(deltaX) > Math.abs(deltaY)) {
                        if (deltaX > 0) {
                            this.scrollToTop();
                        } else {
                            this.scrollToBottom();
                        }
                    }
                } else if (distance < 10) {
                    // Tap to toggle controls (mobile)
                    this.toggleMobileControls();
                }
            }

            touchStartDistance = 0;
        };

        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd, { passive: true });

        // Store touch event listeners
        this.eventListeners.set('touchstart', [handleTouchStart as EventListener]);
        this.eventListeners.set('touchmove', [handleTouchMove as EventListener]);
        this.eventListeners.set('touchend', [handleTouchEnd as EventListener]);
    }

    /**
     * Toggle mobile controls visibility (minimal viewer - no controls to toggle)
     */
    private toggleMobileControls(): void {
        // Minimal viewer has no controls to toggle
        return;
    }

    /**
     * Create enhanced navigation controls
     */
    private createNavigationControls(): HTMLElement {
        const navContainer = document.createElement('div');
        navContainer.className = 'pdf-nav-controls pdf-control-group';
        navContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 2px;
            background: #f8f9fa;
            border-radius: 6px;
            padding: 4px;
            border: 1px solid #e9ecef;
        `;

        // First page button
        const firstBtn = document.createElement('button');
        firstBtn.className = 'pdf-nav-btn pdf-first-btn';
        firstBtn.innerHTML = '<i class="fas fa-step-backward"></i>';
        firstBtn.title = 'First page (Home)';
        firstBtn.style.cssText = this.getButtonStyles();
        firstBtn.addEventListener('click', () => this.goToPage(1));

        // Previous page button
        const prevBtn = document.createElement('button');
        prevBtn.className = 'pdf-nav-btn pdf-prev-btn';
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevBtn.title = 'Previous page (←)';
        prevBtn.style.cssText = this.getButtonStyles();
        prevBtn.addEventListener('click', () => this.previousPage());

        // Page input container
        const pageInputContainer = document.createElement('div');
        pageInputContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 4px;
            margin: 0 6px;
            font-size: 12px;
            color: #666;
        `;

        const pageInput = document.createElement('input');
        pageInput.type = 'number';
        pageInput.min = '1';
        pageInput.max = this.state.totalPages.toString();
        pageInput.value = this.state.currentPage.toString();
        pageInput.className = 'pdf-page-input';
        pageInput.style.cssText = `
            width: ${this.state.isMobile ? '40px' : '50px'};
            padding: 4px 6px;
            border: 1px solid #ddd;
            border-radius: 3px;
            text-align: center;
            font-size: 12px;
            background: white;
        `;
        pageInput.addEventListener('change', (e) => {
            const page = parseInt((e.target as HTMLInputElement).value);
            if (page >= 1 && page <= this.state.totalPages) {
                this.goToPage(page);
            } else {
                pageInput.value = this.state.currentPage.toString();
            }
        });
        pageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                pageInput.blur();
            }
        });

        const pageLabel = document.createElement('span');
        pageLabel.textContent = `of ${this.state.totalPages}`;
        pageLabel.style.cssText = 'font-size: 12px; color: #666; white-space: nowrap;';

        pageInputContainer.appendChild(pageInput);
        if (!this.state.isMobile) {
            pageInputContainer.appendChild(pageLabel);
        }

        // Next page button
        const nextBtn = document.createElement('button');
        nextBtn.className = 'pdf-nav-btn pdf-next-btn';
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextBtn.title = 'Next page (→)';
        nextBtn.style.cssText = this.getButtonStyles();
        nextBtn.addEventListener('click', () => this.nextPage());

        // Last page button
        const lastBtn = document.createElement('button');
        lastBtn.className = 'pdf-nav-btn pdf-last-btn';
        lastBtn.innerHTML = '<i class="fas fa-step-forward"></i>';
        lastBtn.title = 'Last page (End)';
        lastBtn.style.cssText = this.getButtonStyles();
        lastBtn.addEventListener('click', () => this.goToPage(this.state.totalPages));

        navContainer.appendChild(firstBtn);
        navContainer.appendChild(prevBtn);
        navContainer.appendChild(pageInputContainer);
        navContainer.appendChild(nextBtn);
        navContainer.appendChild(lastBtn);

        return navContainer;
    }

    /**
     * Create enhanced zoom controls
     */
    private createZoomControls(): HTMLElement {
        const zoomContainer = document.createElement('div');
        zoomContainer.className = 'pdf-zoom-controls pdf-control-group';
        zoomContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 2px;
            background: #f8f9fa;
            border-radius: 6px;
            padding: 4px;
            border: 1px solid #e9ecef;
        `;

        // Zoom out button
        const zoomOutBtn = document.createElement('button');
        zoomOutBtn.className = 'pdf-zoom-btn pdf-zoom-out-btn';
        zoomOutBtn.innerHTML = '<i class="fas fa-search-minus"></i>';
        zoomOutBtn.title = 'Zoom out (Ctrl+-)';
        zoomOutBtn.style.cssText = this.getButtonStyles();
        zoomOutBtn.addEventListener('click', () => this.zoomOut());

        // Zoom dropdown/display
        const zoomDisplay = document.createElement('div');
        zoomDisplay.className = 'pdf-zoom-display';
        zoomDisplay.style.cssText = `
            position: relative;
            margin: 0 4px;
        `;

        const zoomSelect = document.createElement('select');
        zoomSelect.className = 'pdf-zoom-select';
        zoomSelect.style.cssText = `
            padding: 4px 8px;
            border: 1px solid #ddd;
            border-radius: 3px;
            font-size: 11px;
            background: white;
            cursor: pointer;
            appearance: none;
            min-width: ${this.state.isMobile ? '60px' : '80px'};
        `;

        // Populate zoom options
        this.zoomPresets.forEach(preset => {
            const option = document.createElement('option');
            option.value = preset.value.toString();
            option.textContent = preset.label;
            zoomSelect.appendChild(option);
        });

        // Update selected value
        this.updateZoomSelect(zoomSelect);

        zoomSelect.addEventListener('change', (e) => {
            const value = (e.target as HTMLSelectElement).value;
            if (value === 'fit-width') {
                this.fitToWidth();
            } else if (value === 'fit-page') {
                this.fitToPage();
            } else {
                const scale = parseFloat(value);
                if (!isNaN(scale)) {
                    this.setZoom(scale);
                }
            }
        });

        zoomDisplay.appendChild(zoomSelect);

        // Zoom in button
        const zoomInBtn = document.createElement('button');
        zoomInBtn.className = 'pdf-zoom-btn pdf-zoom-in-btn';
        zoomInBtn.innerHTML = '<i class="fas fa-search-plus"></i>';
        zoomInBtn.title = 'Zoom in (Ctrl++)';
        zoomInBtn.style.cssText = this.getButtonStyles();
        zoomInBtn.addEventListener('click', () => this.zoomIn());

        // Quick action buttons (desktop only)
        if (!this.state.isMobile) {
            // Fit to width button
            const fitWidthBtn = document.createElement('button');
            fitWidthBtn.className = 'pdf-zoom-btn pdf-fit-width-btn';
            fitWidthBtn.innerHTML = '<i class="fas fa-arrows-alt-h"></i>';
            fitWidthBtn.title = 'Fit to width';
            fitWidthBtn.style.cssText = this.getButtonStyles();
            fitWidthBtn.addEventListener('click', () => this.fitToWidth());

            // Fit to page button
            const fitPageBtn = document.createElement('button');
            fitPageBtn.className = 'pdf-zoom-btn pdf-fit-page-btn';
            fitPageBtn.innerHTML = '<i class="fas fa-expand-arrows-alt"></i>';
            fitPageBtn.title = 'Fit to page';
            fitPageBtn.style.cssText = this.getButtonStyles();
            fitPageBtn.addEventListener('click', () => this.fitToPage());

            // Actual size button
            const actualSizeBtn = document.createElement('button');
            actualSizeBtn.className = 'pdf-zoom-btn pdf-actual-size-btn';
            actualSizeBtn.innerHTML = '<i class="fas fa-search"></i>';
            actualSizeBtn.title = 'Actual size (Ctrl+0)';
            actualSizeBtn.style.cssText = this.getButtonStyles();
            actualSizeBtn.addEventListener('click', () => this.setZoom(1.0));

            zoomContainer.appendChild(zoomOutBtn);
            zoomContainer.appendChild(zoomDisplay);
            zoomContainer.appendChild(zoomInBtn);
            zoomContainer.appendChild(this.createSeparator());
            zoomContainer.appendChild(fitWidthBtn);
            zoomContainer.appendChild(fitPageBtn);
            zoomContainer.appendChild(actualSizeBtn);
        } else {
            // Mobile layout - just essential controls
            zoomContainer.appendChild(zoomOutBtn);
            zoomContainer.appendChild(zoomDisplay);
            zoomContainer.appendChild(zoomInBtn);
        }

        return zoomContainer;
    }

    /**
     * Create separator element
     */
    private createSeparator(): HTMLElement {
        const separator = document.createElement('div');
        separator.style.cssText = `
            width: 1px;
            height: 20px;
            background: #ddd;
            margin: 0 4px;
        `;
        return separator;
    }

    /**
     * Create additional controls (fullscreen, download, etc.)
     */
    private createAdditionalControls(): HTMLElement | null {
        if (this.state.isMobile) return null; // Hide on mobile to save space

        const additionalContainer = document.createElement('div');
        additionalContainer.className = 'pdf-additional-controls pdf-control-group';
        additionalContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 2px;
            background: #f8f9fa;
            border-radius: 6px;
            padding: 4px;
            border: 1px solid #e9ecef;
        `;

        // Fullscreen button
        if (this.config.enableFullscreen) {
            const fullscreenBtn = document.createElement('button');
            fullscreenBtn.className = 'pdf-additional-btn pdf-fullscreen-btn';
            fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
            fullscreenBtn.title = 'Toggle fullscreen (Ctrl+F)';
            fullscreenBtn.style.cssText = this.getButtonStyles();
            fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
            additionalContainer.appendChild(fullscreenBtn);
        }

        // Download button
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'pdf-additional-btn pdf-download-btn';
        downloadBtn.innerHTML = '<i class="fas fa-download"></i>';
        downloadBtn.title = 'Download PDF';
        downloadBtn.style.cssText = this.getButtonStyles();
        downloadBtn.addEventListener('click', () => this.downloadPDF());
        additionalContainer.appendChild(downloadBtn);

        return additionalContainer.children.length > 0 ? additionalContainer : null;
    }

    /**
     * Download PDF file
     */
    private downloadPDF(): void {
        // Get current attachment data from global context
        const attachment = (window as any).lastRenderedEmail?.attachments?.find((att: any) => 
            att.contentType === 'application/pdf'
        );

        if (attachment && attachment.filename) {
            // Trigger download through attachment handler
            if ((window as any).AttachmentHandler?.downloadAttachment) {
                (window as any).AttachmentHandler.downloadAttachment(attachment);
            } else {
                this.debugLog('Download handler not available');
            }
        } else {
            this.debugLog('No attachment data available for download');
        }
    }

    /**
     * Update zoom select dropdown
     */
    private updateZoomSelect(zoomSelect?: HTMLSelectElement): void {
        const select = zoomSelect || this.container?.querySelector('.pdf-zoom-select') as HTMLSelectElement;
        if (!select) return;

        const currentScale = this.state.scale;
        let selectedValue = currentScale.toString();

        // Check if current scale matches a preset
        const matchingPreset = this.zoomPresets.find(preset => 
            typeof preset.value === 'number' && Math.abs(preset.value - currentScale) < 0.01
        );

        if (matchingPreset) {
            selectedValue = matchingPreset.value.toString();
        } else {
            // Add custom zoom level if not in presets
            const customOption = Array.from(select.options).find(opt => opt.value === currentScale.toString());
            if (!customOption) {
                const option = document.createElement('option');
                option.value = currentScale.toString();
                option.textContent = `${Math.round(currentScale * 100)}%`;
                
                // Insert in correct position
                let inserted = false;
                for (let i = 0; i < select.options.length; i++) {
                    const optionValue = parseFloat(select.options[i].value);
                    if (!isNaN(optionValue) && optionValue > currentScale) {
                        select.insertBefore(option, select.options[i]);
                        inserted = true;
                        break;
                    }
                }
                if (!inserted) {
                    select.appendChild(option);
                }
            }
        }

        select.value = selectedValue;
    }

    /**
     * Create enhanced search controls
     */
    private createSearchControls(): HTMLElement {
        const searchContainer = document.createElement('div');
        searchContainer.className = 'pdf-search-controls pdf-control-group';
        searchContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 2px;
            background: #f8f9fa;
            border-radius: 6px;
            padding: 4px;
            border: 1px solid #e9ecef;
            position: relative;
        `;

        // Search input container
        const searchInputContainer = document.createElement('div');
        searchInputContainer.style.cssText = `
            position: relative;
            display: flex;
            align-items: center;
        `;

        // Search input
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = this.state.isMobile ? 'Search...' : 'Search in document...';
        searchInput.className = 'pdf-search-input';
        searchInput.style.cssText = `
            width: ${this.state.isMobile ? '100px' : '160px'};
            padding: 4px 8px;
            padding-right: 24px;
            border: 1px solid #ddd;
            border-radius: 3px;
            font-size: 12px;
            background: white;
        `;

        // Search icon
        const searchIcon = document.createElement('i');
        searchIcon.className = 'fas fa-search';
        searchIcon.style.cssText = `
            position: absolute;
            right: 6px;
            color: #999;
            font-size: 10px;
            pointer-events: none;
        `;

        // Clear search button
        const clearSearchBtn = document.createElement('button');
        clearSearchBtn.className = 'pdf-search-clear-btn';
        clearSearchBtn.innerHTML = '<i class="fas fa-times"></i>';
        clearSearchBtn.title = 'Clear search';
        clearSearchBtn.style.cssText = `
            position: absolute;
            right: 2px;
            background: none;
            border: none;
            padding: 2px;
            cursor: pointer;
            color: #999;
            font-size: 10px;
            border-radius: 2px;
            opacity: 0;
            transition: opacity 0.2s;
        `;
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            this.clearSearch();
        });

        searchInputContainer.appendChild(searchInput);
        searchInputContainer.appendChild(searchIcon);
        searchInputContainer.appendChild(clearSearchBtn);

        // Search navigation buttons
        const searchPrevBtn = document.createElement('button');
        searchPrevBtn.className = 'pdf-search-btn pdf-search-prev-btn';
        searchPrevBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
        searchPrevBtn.title = 'Previous match';
        searchPrevBtn.style.cssText = this.getButtonStyles();
        searchPrevBtn.disabled = true;
        searchPrevBtn.addEventListener('click', () => this.previousSearchResult());

        const searchNextBtn = document.createElement('button');
        searchNextBtn.className = 'pdf-search-btn pdf-search-next-btn';
        searchNextBtn.innerHTML = '<i class="fas fa-chevron-down"></i>';
        searchNextBtn.title = 'Next match';
        searchNextBtn.style.cssText = this.getButtonStyles();
        searchNextBtn.disabled = true;
        searchNextBtn.addEventListener('click', () => this.nextSearchResult());

        // Search results indicator
        const searchResults = document.createElement('span');
        searchResults.className = 'pdf-search-results';
        searchResults.style.cssText = `
            font-size: 11px;
            color: #666;
            margin: 0 4px;
            white-space: nowrap;
            min-width: ${this.state.isMobile ? '0' : '60px'};
        `;

        // Search options (desktop only)
        let searchOptionsBtn: HTMLButtonElement | null = null;
        if (!this.state.isMobile) {
            searchOptionsBtn = document.createElement('button');
            searchOptionsBtn.className = 'pdf-search-options-btn';
            searchOptionsBtn.innerHTML = '<i class="fas fa-cog"></i>';
            searchOptionsBtn.title = 'Search options';
            searchOptionsBtn.style.cssText = this.getButtonStyles();
            searchOptionsBtn.addEventListener('click', () => this.toggleSearchOptions());
        }

        // Search input event handlers
        let searchTimeout: number | undefined;
        searchInput.addEventListener('input', (e) => {
            const value = (e.target as HTMLInputElement).value;
            
            // Show/hide clear button
            clearSearchBtn.style.opacity = value ? '1' : '0';
            
            // Debounce search
            if (searchTimeout) clearTimeout(searchTimeout);
            searchTimeout = window.setTimeout(() => {
                this.performSearch(value);
            }, 300);
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                    this.previousSearchResult();
                } else {
                    this.nextSearchResult();
                }
            } else if (e.key === 'Escape') {
                searchInput.blur();
                this.clearSearch();
            }
        });

        // Assemble search controls
        searchContainer.appendChild(searchInputContainer);
        searchContainer.appendChild(searchPrevBtn);
        searchContainer.appendChild(searchNextBtn);
        searchContainer.appendChild(searchResults);
        
        if (searchOptionsBtn) {
            searchContainer.appendChild(this.createSeparator());
            searchContainer.appendChild(searchOptionsBtn);
        }

        return searchContainer;
    }

    /**
     * Toggle search options
     */
    private toggleSearchOptions(): void {
        // TODO: Implement search options panel
        this.debugLog('Search options clicked');
    }

    /**
     * Clear search
     */
    private clearSearch(): void {
        this.state.searchTerm = '';
        this.state.searchResults = [];
        this.state.currentSearchIndex = -1;
        this.updateSearchUI();
        this.clearSearchHighlights();
    }

    /**
     * Clear search highlights
     */
    private clearSearchHighlights(): void {
        // Remove any existing search highlights
        const highlights = document.querySelectorAll('.pdf-search-highlight');
        highlights.forEach(highlight => {
            const parent = highlight.parentNode;
            if (parent) {
                parent.replaceChild(document.createTextNode(highlight.textContent || ''), highlight);
                parent.normalize();
            }
        });
    }

    /**
     * Update search UI
     */
    private updateSearchUI(): void {
        const resultsElement = this.container?.querySelector('.pdf-search-results');
        const prevBtn = this.container?.querySelector('.pdf-search-prev-btn') as HTMLButtonElement;
        const nextBtn = this.container?.querySelector('.pdf-search-next-btn') as HTMLButtonElement;

        if (resultsElement) {
            if (this.state.searchResults.length > 0) {
                const current = this.state.currentSearchIndex + 1;
                const total = this.state.searchResults.length;
                resultsElement.textContent = `${current}/${total}`;
            } else if (this.state.searchTerm) {
                resultsElement.textContent = 'No results';
            } else {
                resultsElement.textContent = '';
            }
        }

        if (prevBtn && nextBtn) {
            const hasResults = this.state.searchResults.length > 0;
            prevBtn.disabled = !hasResults;
            nextBtn.disabled = !hasResults;
        }
    }

    /**
     * Get button styles
     */
    private getButtonStyles(): string {
        return `
            background: none;
            border: none;
            padding: 6px 8px;
            cursor: pointer;
            border-radius: 3px;
            color: #666;
            font-size: 12px;
            transition: all 0.2s;
            
            &:hover {
                background: #e9ecef;
                color: #333;
            }
            
            &:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
        `;
    }

    /**
     * Get PDF data from attachment using safe data processor
     */
    private async getPDFData(attachment: Attachment): Promise<ArrayBuffer> {
        try {
            // Use safe data processor for consistent handling
            const { default: AttachmentDataProcessor } = await import('../utils/attachment-data-processor.js');
            
            // If attachment has Gmail ID but no content, fetch it first
            if (attachment.attachmentId && attachment.messageId && !attachment.content) {
                const attachmentManager = (window as any).AttachmentManager?.getInstance();
                if (attachmentManager) {
                    attachment.content = await attachmentManager.fetchGmailAttachmentContent(attachment);
                }
            }

            // If attachment has URL but no content, fetch it
            if (attachment.url && !attachment.content) {
                const response = await fetch(attachment.url);
                if (!response.ok) {
                    throw new Error(`Failed to fetch PDF: ${response.status}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                // Convert to base64 for storage in attachment
                const uint8Array = new Uint8Array(arrayBuffer);
                const base64 = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
                attachment.content = base64;
            }

            if (!attachment.content) {
                throw new Error('No PDF data available');
            }

            // Use safe data processor to get ArrayBuffer
            return await AttachmentDataProcessor.getArrayBuffer(attachment);
            
        } catch (error) {
            this.debugLog('Error getting PDF data', { 
                error: error instanceof Error ? error.message : 'Unknown error',
                attachment: {
                    filename: attachment.filename,
                    hasContent: !!attachment.content,
                    hasAttachmentId: !!attachment.attachmentId,
                    hasUrl: !!attachment.url
                }
            });
            throw error;
        }
    }

    /**
     * Enhanced render page with CSS-based auto-fitting
     */
    private async renderPage(pageNumber: number): Promise<void> {
        if (!this.currentDocument) {
            throw new Error('No PDF document loaded');
        }

        // Cancel any ongoing render task
        if (this.currentRenderTask) {
            this.currentRenderTask.cancel();
        }

        // Show loading state for page navigation (not for initial load)
        if (!this.isInitialRender) {
            this.showCanvasLoadingState();
        }

        try {
            const page = await this.currentDocument.getPage(pageNumber);
            let renderScale = this.state.scale;
            let viewport = page.getViewport({ scale: renderScale });
            let scaleReduced = false;

            // Intelligently reduce scale if canvas would be too large
            let canvasSize = viewport.width * viewport.height * 4; // 4 bytes per pixel
            while (canvasSize > this.config.maxCanvasSize && renderScale > this.config.minScale) {
                renderScale = Math.max(renderScale * 0.8, this.config.minScale);
                viewport = page.getViewport({ scale: renderScale });
                canvasSize = viewport.width * viewport.height * 4;
                scaleReduced = true;
            }

            // Emergency fallback for extremely large canvases
            if (canvasSize > this.config.maxCanvasSize) {
                const maxPossibleScale = Math.sqrt(this.config.maxCanvasSize / (viewport.width * viewport.height * 4));
                renderScale = Math.max(maxPossibleScale * 0.9, 0.1);
                viewport = page.getViewport({ scale: renderScale });
                scaleReduced = true;
            }

            const canvas = this.container?.querySelector('.pdf-canvas') as HTMLCanvasElement;
            const canvasContainer = this.container?.querySelector('.pdf-canvas-container') as HTMLElement;
            
            if (!canvas) {
                throw new Error('Canvas element not found');
            }

            const context = canvas.getContext('2d');
            if (!context) {
                throw new Error('Failed to get canvas context');
            }

            // Set canvas dimensions to actual PDF size
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };

            this.currentRenderTask = page.render(renderContext);
            await this.currentRenderTask.promise;

            this.state.currentPage = pageNumber;
            
            // Apply CSS-based fitting after rendering
            if (canvasContainer) {
                await this.applyCSSBasedFitting(canvasContainer);
            }
            
            this.updateUI();

            // Mark initial render as complete
            if (this.isInitialRender) {
                this.isInitialRender = false;
            }

            this.debugLog('Page rendered with CSS fitting', {
                pageNumber,
                scale: renderScale,
                width: viewport.width,
                height: viewport.height,
                canvasSize,
                scaleReduced
            });

        } catch (error) {
            if (error instanceof Error && error.message.includes('cancelled')) {
                return;
            }
            
            this.debugLog('Render error', { 
                error: (error as Error).message, 
                pageNumber,
                scale: this.state.scale
            });
            
            throw error;
        } finally {
            this.clearCanvasLoadingState();
        }
    }

    /**
     * Show scale reduction notification to user
     */
    private showScaleReductionNotification(originalScale: number, newScale: number): void {
        // Create notification element if it doesn't exist
        let notification = document.querySelector('.pdf-scale-notification') as HTMLElement;
        
        if (!notification) {
            notification = document.createElement('div');
            notification.className = 'pdf-scale-notification';
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #fff3cd;
                color: #856404;
                border: 1px solid #ffeaa7;
                border-radius: 4px;
                padding: 12px 16px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                z-index: 10001;
                max-width: 300px;
                font-size: 13px;
                line-height: 1.4;
                display: flex;
                align-items: center;
                gap: 8px;
                transform: translateX(100%);
                transition: transform 0.3s ease;
            `;
            
            document.body.appendChild(notification);
        }

        // Update notification content
        const originalPercent = Math.round(originalScale * 100);
        const newPercent = Math.round(newScale * 100);
        
        notification.innerHTML = `
            <i class="fas fa-exclamation-triangle" style="color: #f39c12; flex-shrink: 0;"></i>
            <div>
                <strong>Zoom reduced automatically</strong><br>
                PDF page too large at ${originalPercent}%. Reduced to ${newPercent}% for optimal performance.
            </div>
            <button type="button" style="
                background: none;
                border: none;
                color: #856404;
                cursor: pointer;
                padding: 0;
                margin-left: auto;
                font-size: 16px;
                opacity: 0.7;
            " onclick="this.parentElement.style.transform='translateX(100%)'">
                <i class="fas fa-times"></i>
            </button>
        `;

        // Show notification
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (notification.style.transform === 'translateX(0px)') {
                notification.style.transform = 'translateX(100%)';
            }
        }, 5000);

        this.debugLog('Scale reduction notification shown', { originalPercent, newPercent });
    }

    /**
     * Show error notification to user
     */
    private showErrorNotification(message: string): void {
        // Create notification element if it doesn't exist
        let notification = document.querySelector('.pdf-error-notification') as HTMLElement;
        
        if (!notification) {
            notification = document.createElement('div');
            notification.className = 'pdf-error-notification';
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #f8d7da;
                color: #721c24;
                border: 1px solid #f5c6cb;
                border-radius: 4px;
                padding: 12px 16px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                z-index: 10001;
                max-width: 300px;
                font-size: 13px;
                line-height: 1.4;
                display: flex;
                align-items: center;
                gap: 8px;
                transform: translateX(100%);
                transition: transform 0.3s ease;
            `;
            
            document.body.appendChild(notification);
        }

        // Update notification content
        notification.innerHTML = `
            <i class="fas fa-exclamation-circle" style="color: #dc3545; flex-shrink: 0;"></i>
            <div>
                <strong>Error</strong><br>
                ${message}
            </div>
            <button type="button" style="
                background: none;
                border: none;
                color: #721c24;
                cursor: pointer;
                padding: 0;
                margin-left: auto;
                font-size: 16px;
                opacity: 0.7;
            " onclick="this.parentElement.style.transform='translateX(100%)'">
                <i class="fas fa-times"></i>
            </button>
        `;

        // Show notification
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Auto-hide after 4 seconds
        setTimeout(() => {
            if (notification.style.transform === 'translateX(0px)') {
                notification.style.transform = 'translateX(100%)';
            }
        }, 4000);

        this.debugLog('Error notification shown', { message });
    }

    /**
     * Navigation methods for continuous scroll
     */
    private scrollToPage(pageNumber: number): void {
        if (pageNumber < 1 || pageNumber > this.state.totalPages) return;
        
        const contentArea = this.container?.querySelector('.pdf-viewer-content') as HTMLElement;
        const pagesContainer = contentArea?.querySelector('.pdf-pages-container') as HTMLElement;
        
        if (!contentArea || !pagesContainer) return;
        
        const pageContainer = pagesContainer.querySelector(`[data-page="${pageNumber}"]`) as HTMLElement;
        if (!pageContainer) return;
        
        // Calculate scroll position
        const containerTop = pagesContainer.offsetTop;
        const pageTop = pageContainer.offsetTop - containerTop;
        
        // Scroll to page with smooth animation
        contentArea.scrollTo({
            top: pageTop - 20, // Small offset for better visibility
            behavior: 'smooth'
        });
        
        this.state.currentPage = pageNumber;
        this.updateUI();
    }

    /**
     * Legacy navigation methods (now using continuous scroll)
     */
    private async previousPage(): Promise<void> {
        if (this.state.currentPage > 1) {
            this.scrollToPage(this.state.currentPage - 1);
        }
    }

    private async nextPage(): Promise<void> {
        if (this.state.currentPage < this.state.totalPages) {
            this.scrollToPage(this.state.currentPage + 1);
        }
    }

    private async goToPage(pageNumber: number): Promise<void> {
        this.scrollToPage(pageNumber);
    }

    /**
     * Zoom methods for constrained containers (CSS-only, no re-rendering)
     */
    private async zoomIn(): Promise<void> {
        const newScale = Math.min(this.state.scale + this.config.scaleStep, this.config.maxScale);
        if (newScale !== this.state.scale) {
                this.state.scale = newScale;
            this.updateCanvasScales(); // Fast CSS update, no re-rendering
            this.debugLog('Zoom in applied', { scale: this.state.scale });
        }
    }

    private async zoomOut(): Promise<void> {
        const newScale = Math.max(this.state.scale - this.config.scaleStep, this.config.minScale);
        if (newScale !== this.state.scale) {
                this.state.scale = newScale;
            this.updateCanvasScales(); // Fast CSS update, no re-rendering
            this.debugLog('Zoom out applied', { scale: this.state.scale });
        }
    }

    private async setZoom(scale: number): Promise<void> {
        const newScale = Math.min(Math.max(scale, this.config.minScale), this.config.maxScale);
        if (newScale !== this.state.scale) {
            this.state.scale = newScale;
            this.updateCanvasScales(); // Fast CSS update, no re-rendering
            this.debugLog('Zoom set applied', { scale: this.state.scale });
        }
    }

    private async fitToWidth(): Promise<void> {
        // For constrained containers, fit to width means scale to fill container width
        // Since containers are already sized to fit available width, use scale 1.0
        const newScale = 1.0;
        
        if (newScale !== this.state.scale) {
            this.state.scale = newScale;
            this.updateCanvasScales(); // Fast CSS update, no re-rendering
            this.debugLog('Fit to width applied', { scale: this.state.scale });
        }
    }

    private async resetZoom(): Promise<void> {
        if (this.state.scale !== 1.0) {
            this.state.scale = 1.0;
            this.updateCanvasScales(); // Fast CSS update, no re-rendering
            this.debugLog('Zoom reset applied', { scale: this.state.scale });
        }
    }

    /**
     * Update canvas scales without re-rendering (fast CSS-only zoom)
     */
    private updateCanvasScales(): void {
        const pagesContainer = this.container?.querySelector('.pdf-pages-container') as HTMLElement;
        if (!pagesContainer) return;

        const pageContainers = pagesContainer.querySelectorAll('.pdf-page-container');
        pageContainers.forEach((pageContainer) => {
            const containerElement = pageContainer as HTMLElement;
            const canvas = containerElement.querySelector('.pdf-page-canvas') as HTMLCanvasElement;
            const baseScale = (containerElement as any).__baseScale || 1.0;
            const dpiCompensation = (containerElement as any).__dpiCompensation || 1.0;
            
            if (canvas) {
                // Apply user zoom on top of base scale with DPI compensation
                const finalScale = baseScale * this.state.scale * dpiCompensation;
                canvas.style.transform = `scale(${finalScale})`;
                
                this.debugLog('Canvas scale updated with DPI compensation', { 
                    baseScale, 
                    userScale: this.state.scale,
                    dpiCompensation,
                    finalScale 
                });
            }
        });
    }

    /**
     * Fit pages to container (constrained - only affects content zoom)
     */
    private async fitToPage(): Promise<void> {
        // Reset to 1.0 scale for constrained containers
        const newScale = 1.0;
        
        if (newScale !== this.state.scale) {
            this.state.scale = newScale;
            this.updateCanvasScales(); // Fast CSS update, no re-rendering
            this.debugLog('Fit to page applied', { scale: this.state.scale });
        }
    }

    /**
     * Toggle fullscreen mode
     */
    private toggleFullscreen(): void {
        if (this.state.isFullscreen) {
            this.exitFullscreen();
        } else {
            this.enterFullscreen();
        }
    }

    /**
     * Enter fullscreen mode
     */
    private enterFullscreen(): void {
        if (!this.container) return;

        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        }

        this.state.isFullscreen = true;
        this.container.classList.add('pdf-fullscreen');
        this.updateUI();
    }

    /**
     * Exit fullscreen mode
     */
    private exitFullscreen(): void {
        if (!this.container) return;

        if (document.exitFullscreen) {
            document.exitFullscreen();
        }

        this.state.isFullscreen = false;
        this.container.classList.remove('pdf-fullscreen');
        this.updateUI();
    }

    /**
     * Perform search with actual text extraction
     */
    private async performSearch(term: string): Promise<void> {
        this.state.searchTerm = term.trim();
        
        if (!this.state.searchTerm || !this.currentDocument) {
            this.clearSearch();
            return;
        }

        this.debugLog('Performing search', { term: this.state.searchTerm });

        try {
            this.state.searchResults = [];
            
            // Search through all pages
            for (let pageNum = 1; pageNum <= this.state.totalPages; pageNum++) {
                const pageResults = await this.searchInPage(pageNum, this.state.searchTerm);
                this.state.searchResults.push(...pageResults);
            }

            // Start from first result
            this.state.currentSearchIndex = this.state.searchResults.length > 0 ? 0 : -1;
            
            // Navigate to first result if found
            if (this.state.currentSearchIndex >= 0) {
                await this.goToSearchResult(this.state.currentSearchIndex);
            }

            this.updateSearchUI();
            
            this.debugLog('Search completed', { 
                term: this.state.searchTerm,
                resultCount: this.state.searchResults.length 
            });

        } catch (error) {
            this.debugLog('Search error', { error: (error as Error).message });
            this.state.searchResults = [];
            this.state.currentSearchIndex = -1;
            this.updateSearchUI();
        }
    }

    /**
     * Search within a specific page
     */
    private async searchInPage(pageNumber: number, searchTerm: string): Promise<SearchResult[]> {
        if (!this.currentDocument) return [];

        try {
            // Get or cache page text content
            let textContent = this.pageTextContent.get(pageNumber);
            if (!textContent) {
                const page = await this.currentDocument.getPage(pageNumber);
                textContent = await page.getTextContent();
                this.pageTextContent.set(pageNumber, textContent);
            }

            const results: SearchResult[] = [];
            const searchRegex = new RegExp(
                this.escapeRegExp(searchTerm), 
                this.config.searchCaseSensitive ? 'g' : 'gi'
            );

            // Extract text content and build search index
            const fullPageText = textContent.items
                .map((item: any) => item.str || '')
                .join(' ');

            let match;
            while ((match = searchRegex.exec(fullPageText)) !== null) {
                results.push({
                    pageNumber,
                    textIndex: match.index,
                    text: match[0],
                    coordinates: {
                        x: 0, // TODO: Calculate actual coordinates
                        y: 0,
                        width: 0,
                        height: 0
                    }
                });

                // Prevent infinite loop
                if (!searchRegex.global) break;
            }

            return results;

        } catch (error) {
            this.debugLog('Error searching page', { pageNumber, error: (error as Error).message });
            return [];
        }
    }

    /**
     * Go to specific search result
     */
    private async goToSearchResult(index: number): Promise<void> {
        if (index < 0 || index >= this.state.searchResults.length) return;

        const result = this.state.searchResults[index];
        this.state.currentSearchIndex = index;

        // Navigate to the page containing the result
        if (result.pageNumber !== this.state.currentPage) {
            await this.goToPage(result.pageNumber);
        }

        // Highlight the search term on the current page
        this.highlightSearchResults();
        
        this.updateSearchUI();
    }

    /**
     * Highlight search results on current page
     */
    private highlightSearchResults(): void {
        // Clear previous highlights
        this.clearSearchHighlights();

        if (!this.state.searchTerm || this.state.searchResults.length === 0) return;

        // Find results for current page
        const pageResults = this.state.searchResults.filter(r => r.pageNumber === this.state.currentPage);
        if (pageResults.length === 0) return;

        // Add CSS for search highlights if not exists
        this.addSearchHighlightStyles();

        // TODO: Implement actual text highlighting on canvas
        // This would require more complex text rendering and coordinate mapping
        this.debugLog('Search highlighting', { 
            currentPage: this.state.currentPage,
            pageResults: pageResults.length 
        });
    }

    /**
     * Add search highlight styles
     */
    private addSearchHighlightStyles(): void {
        const styleId = 'pdf-search-highlight-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .pdf-search-highlight {
                background-color: #ffeb3b !important;
                color: #000 !important;
                padding: 1px 2px;
                border-radius: 2px;
            }
            .pdf-search-highlight.current {
                background-color: #ff9800 !important;
                color: #fff !important;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Navigate to previous search result
     */
    private async previousSearchResult(): Promise<void> {
        if (this.state.searchResults.length === 0) return;

        let newIndex = this.state.currentSearchIndex - 1;
        if (newIndex < 0) {
            newIndex = this.state.searchResults.length - 1; // Wrap to last result
        }

        await this.goToSearchResult(newIndex);
    }

    /**
     * Navigate to next search result
     */
    private async nextSearchResult(): Promise<void> {
        if (this.state.searchResults.length === 0) return;

        let newIndex = this.state.currentSearchIndex + 1;
        if (newIndex >= this.state.searchResults.length) {
            newIndex = 0; // Wrap to first result
        }

        await this.goToSearchResult(newIndex);
    }

    /**
     * Escape special regex characters
     */
    private escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Update UI elements (minimal viewer - very limited UI to update)
     */
    private updateUI(): void {
        // Minimal viewer has no UI elements to update
        // Page tracking is handled by scroll events
        return;
    }

    /**
     * Add mobile-responsive styles
     */
    private addMobileStyles(): void {
        const styleId = 'pdf-mobile-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* PDF Viewer Mobile Styles */
            @media (max-width: ${this.config.mobileBreakpoint}px) {
                .pdf-viewer-header {
                    flex-direction: column !important;
                    gap: 12px !important;
                    padding: 12px !important;
                }

                .pdf-viewer-controls {
                    flex-wrap: wrap;
                    justify-content: center;
                    gap: 8px !important;
                }

                .pdf-control-group.mobile-controls {
                    min-width: auto;
                    flex-shrink: 1;
                }

                .pdf-control-group.mobile-controls .pdf-page-input {
                    width: 40px !important;
                }

                .pdf-control-group.mobile-controls .pdf-zoom-select {
                    min-width: 60px !important;
                }

                .pdf-control-group.mobile-controls button {
                    min-width: 32px;
                    min-height: 32px;
                    padding: 8px !important;
                }

                .pdf-additional-controls {
                    display: none !important;
                }

                .pdf-canvas-container {
                    margin: 8px !important;
                }
            }

            /* Fullscreen styles */
            .pdf-fullscreen {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                z-index: 10000 !important;
                background: white !important;
            }

            .pdf-fullscreen .pdf-viewer-header {
                transition: transform 0.3s ease;
            }

            /* Touch-friendly button styles */
            @media (hover: none) and (pointer: coarse) {
                .pdf-control-group button {
                    min-width: 36px;
                    min-height: 36px;
                    padding: 8px;
                }

                .pdf-page-input,
                .pdf-zoom-select,
                .pdf-search-input {
                    min-height: 36px;
                    padding: 6px 8px;
                }
            }

            /* Button hover effects */
            .pdf-control-group button:hover:not(:disabled) {
                background: #e9ecef !important;
                color: #333 !important;
            }

            .pdf-control-group button:active:not(:disabled) {
                background: #dee2e6 !important;
                transform: translateY(1px);
            }

            .pdf-control-group button:disabled {
                opacity: 0.5 !important;
                cursor: not-allowed !important;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Show loading state
     */
    private showLoadingState(container: HTMLElement): void {
        container.innerHTML = `
            <div class="pdf-loading-state" style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
                color: #666;
                font-size: 14px;
            ">
                <div class="loading-spinner" style="
                    width: 40px;
                    height: 40px;
                    border: 3px solid #f3f3f3;
                    border-top: 3px solid #007bff;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin-bottom: 16px;
                "></div>
                <span>Loading PDF...</span>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
    }

    /**
     * Clear loading state
     */
    private clearLoadingState(container: HTMLElement): void {
        const loadingState = container.querySelector('.pdf-loading-state');
        if (loadingState) {
            loadingState.remove();
        }
    }

    /**
     * Show loading state in canvas area
     */
    private showCanvasLoadingState(): void {
        const canvasContainer = this.container?.querySelector('.pdf-canvas-container');
        if (canvasContainer) {
            // Create loading overlay instead of replacing content
            const loadingOverlay = document.createElement('div');
            loadingOverlay.className = 'pdf-canvas-loading';
            loadingOverlay.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                background: rgba(255, 255, 255, 0.9);
                color: #666;
                font-size: 14px;
                z-index: 10;
            `;
            
            loadingOverlay.innerHTML = `
                <div class="loading-spinner" style="
                    width: 32px;
                    height: 32px;
                    border: 2px solid #f3f3f3;
                    border-top: 2px solid #007bff;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin-bottom: 12px;
                "></div>
                <span>Rendering PDF page...</span>
            `;
            
            // Make sure canvas container is positioned relative for overlay
            const containerStyle = window.getComputedStyle(canvasContainer);
            if (containerStyle.position === 'static') {
                (canvasContainer as HTMLElement).style.position = 'relative';
            }
            
            canvasContainer.appendChild(loadingOverlay);
        }
    }

    /**
     * Clear canvas loading state
     */
    private clearCanvasLoadingState(): void {
        const canvasLoading = this.container?.querySelector('.pdf-canvas-loading');
        if (canvasLoading) {
            canvasLoading.remove();
        }
    }

    /**
     * Show error state
     */
    private showErrorState(container: HTMLElement, error: string): void {
        container.innerHTML = `
            <div class="pdf-error-state" style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
                color: #d32f2f;
                font-size: 14px;
                text-align: center;
                padding: 20px;
            ">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px;"></i>
                <h3 style="margin: 0 0 8px 0;">Failed to Load PDF</h3>
                <p style="margin: 0; color: #666;">${error}</p>
            </div>
        `;
    }

    /**
     * Enhanced cleanup with ResizeObserver
     */
    private cleanup(): void {
        // Cancel any ongoing render task
        if (this.currentRenderTask) {
            this.currentRenderTask.cancel();
            this.currentRenderTask = null;
        }

        // Destroy current document
        if (this.currentDocument) {
            this.currentDocument.destroy();
            this.currentDocument = null;
        }

        // Clear page cache
        this.pageCache.clear();

        // Clear text content cache
        this.pageTextContent.clear();

        // Disconnect ResizeObserver
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }

        // Clear event listeners
        this.eventListeners.forEach((listeners, event) => {
            listeners.forEach(listener => {
                document.removeEventListener(event, listener);
            });
        });
        this.eventListeners.clear();

        // Clear state
        this.state.currentPage = 1;
        this.state.totalPages = 0;
        this.state.error = null;
        this.state.searchTerm = '';
        this.state.searchResults = [];
        this.state.currentSearchIndex = -1;

        this.debugLog('PDF renderer cleanup completed');
    }

    /**
     * Destroy instance
     */
    public destroy(): void {
        this.cleanup();
        this.isInitialized = false;
        this.state.isInitialized = false;
    }

    /**
     * Debug logger
     */
    private debugLog(message: string, data?: any): void {
        if (typeof (window as any).AttachmentHandler?.debugLog === 'function') {
            (window as any).AttachmentHandler.debugLog('PDF Renderer', message, data);
        } else {
            console.log(`[PDF Renderer] ${message}`, data);
        }
    }
}

// Export for global access
(window as any).PDFRenderer = PDFRenderer;

export default PDFRenderer; 