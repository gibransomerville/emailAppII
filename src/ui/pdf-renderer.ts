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
            defaultScale: 1.5,
            maxScale: 4.0,
            minScale: 0.3,
            scaleStep: 0.25,
            enableSearch: true,
            enableNavigation: true,
            enableZoom: true,
            enableFullscreen: true,
            enableTouch: true,
            renderTimeout: 10000,
            maxCanvasSize: 67108864, // 64MB canvas limit for modern devices
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

        // Set up responsive detection
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
     * Set up responsive detection
     */
    private setupResponsiveDetection(): void {
        window.addEventListener('resize', () => {
            this.state.isMobile = window.innerWidth <= this.config.mobileBreakpoint;
            this.updateResponsiveLayout();
        });
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

        // Update control visibility for mobile
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
            
            // Render first page directly (no canvas loading overlay for initial load)
            await this.renderPage(1);

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
     * Create viewer container structure
     */
    private createViewerContainer(): HTMLElement {
        const container = document.createElement('div');
        container.className = 'pdf-viewer-container';
        container.style.cssText = `
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            background: #f5f5f5;
            position: relative;
        `;
        return container;
    }

    /**
     * Create viewer UI with controls
     */
    private createViewerUI(container: HTMLElement, attachment: Attachment): void {
        // Clear any existing content in the container
        container.innerHTML = '';
        
        // Header with controls
        const header = document.createElement('div');
        header.className = 'pdf-viewer-header';
        header.style.cssText = `
            background: #fff;
            border-bottom: 1px solid #e0e0e0;
            padding: 8px 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-shrink: 0;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        `;

        // Title section
        const titleSection = document.createElement('div');
        titleSection.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            flex: 1;
            min-width: 0;
        `;

        const titleIcon = document.createElement('i');
        titleIcon.className = 'fas fa-file-pdf';
        titleIcon.style.cssText = 'color: #d32f2f; font-size: 16px;';

        const titleText = document.createElement('span');
        titleText.textContent = attachment.filename || 'PDF Document';
        titleText.style.cssText = `
            font-weight: 500;
            color: #333;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-size: 14px;
        `;

        titleSection.appendChild(titleIcon);
        titleSection.appendChild(titleText);

        // Controls section
        const controlsSection = document.createElement('div');
        controlsSection.className = 'pdf-viewer-controls';
        controlsSection.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;
        `;

        // Navigation controls
        if (this.config.enableNavigation) {
            const navControls = this.createNavigationControls();
            controlsSection.appendChild(navControls);
        }

        // Zoom controls
        if (this.config.enableZoom) {
            const zoomControls = this.createZoomControls();
            controlsSection.appendChild(zoomControls);
        }

        // Search controls
        if (this.config.enableSearch) {
            const searchControls = this.createSearchControls();
            controlsSection.appendChild(searchControls);
        }

        // Additional controls
        const additionalControls = this.createAdditionalControls();
        if (additionalControls) {
            controlsSection.appendChild(additionalControls);
        }

        header.appendChild(titleSection);
        header.appendChild(controlsSection);

        // Content area
        const contentArea = document.createElement('div');
        contentArea.className = 'pdf-viewer-content';
        contentArea.style.cssText = `
            flex: 1;
            overflow: auto;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding: 16px;
            background: #f5f5f5;
        `;

        // Canvas container
        const canvasContainer = document.createElement('div');
        canvasContainer.className = 'pdf-canvas-container';
        canvasContainer.style.cssText = `
            background: white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-radius: 4px;
            overflow: hidden;
            max-width: 100%;
            max-height: 100%;
        `;

        // Canvas
        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-canvas';
        canvas.style.cssText = `
            display: block;
            max-width: 100%;
            height: auto;
        `;

        canvasContainer.appendChild(canvas);
        contentArea.appendChild(canvasContainer);

        // Status bar
        const statusBar = document.createElement('div');
        statusBar.className = 'pdf-viewer-status';
        statusBar.style.cssText = `
            background: #fff;
            border-top: 1px solid #e0e0e0;
            padding: 8px 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 12px;
            color: #666;
            flex-shrink: 0;
        `;

        const pageInfo = document.createElement('span');
        pageInfo.className = 'pdf-page-info';
        pageInfo.textContent = `Page ${this.state.currentPage} of ${this.state.totalPages}`;

        const scaleInfo = document.createElement('span');
        scaleInfo.className = 'pdf-scale-info';
        scaleInfo.textContent = `${Math.round(this.state.scale * 100)}%`;

        statusBar.appendChild(pageInfo);
        statusBar.appendChild(scaleInfo);

        // Assemble viewer
        container.appendChild(header);
        container.appendChild(contentArea);
        container.appendChild(statusBar);
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
                    this.previousPage();
                    break;
                case 'ArrowRight':
                case 'ArrowDown':
                case 'PageDown':
                case ' ':
                    e.preventDefault();
                    this.nextPage();
                    break;
                case 'Home':
                    e.preventDefault();
                    this.goToPage(1);
                    break;
                case 'End':
                    e.preventDefault();
                    this.goToPage(this.state.totalPages);
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
                            this.previousPage();
                        } else {
                            this.nextPage();
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
     * Toggle mobile controls visibility
     */
    private toggleMobileControls(): void {
        if (!this.state.isMobile || !this.container) return;

        const header = this.container.querySelector('.pdf-viewer-header') as HTMLElement;
        const statusBar = this.container.querySelector('.pdf-viewer-status') as HTMLElement;

        if (header && statusBar) {
            const isHidden = header.style.transform === 'translateY(-100%)';
            
            if (isHidden) {
                header.style.transform = 'translateY(0)';
                statusBar.style.transform = 'translateY(0)';
            } else {
                header.style.transform = 'translateY(-100%)';
                statusBar.style.transform = 'translateY(100%)';
            }
        }
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
     * Render specific page
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
                renderScale = Math.max(renderScale * 0.8, this.config.minScale); // Reduce by 20% each time
                viewport = page.getViewport({ scale: renderScale });
                canvasSize = viewport.width * viewport.height * 4;
                scaleReduced = true;
            }

            // If we still can't render at minimum scale, use emergency fallback
            if (canvasSize > this.config.maxCanvasSize) {
                // Calculate the maximum possible scale for this page
                const maxPossibleScale = Math.sqrt(this.config.maxCanvasSize / (viewport.width * viewport.height * 4));
                renderScale = Math.max(maxPossibleScale * 0.9, 0.1); // 90% of max with 0.1 minimum
                viewport = page.getViewport({ scale: renderScale });
                canvasSize = viewport.width * viewport.height * 4;
                scaleReduced = true;
                
                this.debugLog('Emergency scale reduction applied', {
                    originalScale: this.state.scale,
                    emergencyScale: renderScale,
                    maxPossibleScale,
                    canvasSize,
                    maxCanvasSize: this.config.maxCanvasSize
                });
            }

            // Update state if scale was reduced
            if (scaleReduced) {
                const originalScale = this.state.scale;
                this.state.scale = renderScale;
                
                // Show user notification about scale reduction
                this.showScaleReductionNotification(originalScale, renderScale);
                
                this.debugLog('Scale automatically reduced', {
                    originalScale,
                    newScale: renderScale,
                    canvasSize,
                    maxCanvasSize: this.config.maxCanvasSize
                });
            }

            const canvas = this.container?.querySelector('.pdf-canvas') as HTMLCanvasElement;
            if (!canvas) {
                throw new Error('Canvas element not found');
            }

            const context = canvas.getContext('2d');
            if (!context) {
                throw new Error('Failed to get canvas context');
            }

            // Set canvas dimensions
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };

            this.currentRenderTask = page.render(renderContext);
            await this.currentRenderTask.promise;

            this.state.currentPage = pageNumber;
            this.updateUI();

            // Mark initial render as complete
            if (this.isInitialRender) {
                this.isInitialRender = false;
            }

            this.debugLog('Page rendered successfully', {
                pageNumber,
                scale: this.state.scale,
                width: viewport.width,
                height: viewport.height,
                canvasSize,
                scaleReduced
            });

        } catch (error) {
            if (error instanceof Error && error.message.includes('cancelled')) {
                return; // Render was cancelled, ignore
            }
            
            // Provide more informative error handling
            this.debugLog('Render error', { 
                error: (error as Error).message, 
                pageNumber,
                scale: this.state.scale
            });
            
            throw error;
        } finally {
            // Always clear canvas loading state
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
     * Navigation methods with enhanced error handling
     */
    private async previousPage(): Promise<void> {
        if (this.state.currentPage > 1) {
            try {
                await this.renderPage(this.state.currentPage - 1);
            } catch (error) {
                this.debugLog('Previous page navigation failed', { 
                    currentPage: this.state.currentPage,
                    error: (error as Error).message 
                });
                // Don't throw - just log the error to prevent unhandled rejections
                this.showErrorNotification('Failed to navigate to previous page');
            }
        }
    }

    private async nextPage(): Promise<void> {
        if (this.state.currentPage < this.state.totalPages) {
            try {
                await this.renderPage(this.state.currentPage + 1);
            } catch (error) {
                this.debugLog('Next page navigation failed', { 
                    currentPage: this.state.currentPage,
                    totalPages: this.state.totalPages,
                    error: (error as Error).message 
                });
                // Don't throw - just log the error to prevent unhandled rejections
                this.showErrorNotification('Failed to navigate to next page');
            }
        }
    }

    private async goToPage(pageNumber: number): Promise<void> {
        if (pageNumber >= 1 && pageNumber <= this.state.totalPages) {
            try {
                await this.renderPage(pageNumber);
            } catch (error) {
                this.debugLog('Go to page navigation failed', { 
                    targetPage: pageNumber,
                    currentPage: this.state.currentPage,
                    error: (error as Error).message 
                });
                // Don't throw - just log the error to prevent unhandled rejections
                this.showErrorNotification(`Failed to navigate to page ${pageNumber}`);
            }
        }
    }

    /**
     * Zoom methods with enhanced error handling
     */
    private async zoomIn(): Promise<void> {
        const newScale = Math.min(this.state.scale + this.config.scaleStep, this.config.maxScale);
        if (newScale !== this.state.scale) {
            try {
                this.state.scale = newScale;
                await this.renderPage(this.state.currentPage);
            } catch (error) {
                // Revert scale on error
                this.state.scale = this.state.scale;
                this.debugLog('Zoom in failed', { 
                    attemptedScale: newScale, 
                    error: (error as Error).message 
                });
                throw error;
            }
        }
    }

    private async zoomOut(): Promise<void> {
        const newScale = Math.max(this.state.scale - this.config.scaleStep, this.config.minScale);
        if (newScale !== this.state.scale) {
            try {
                this.state.scale = newScale;
                await this.renderPage(this.state.currentPage);
            } catch (error) {
                // Revert scale on error
                this.state.scale = this.state.scale;
                this.debugLog('Zoom out failed', { 
                    attemptedScale: newScale, 
                    error: (error as Error).message 
                });
                throw error;
            }
        }
    }

    private async fitToWidth(): Promise<void> {
        const canvas = this.container?.querySelector('.pdf-canvas') as HTMLCanvasElement;
        const container = this.container?.querySelector('.pdf-viewer-content') as HTMLElement;
        
        if (!canvas || !container) return;

        const containerWidth = container.clientWidth - 32; // Account for padding
        const canvasWidth = canvas.width / this.state.scale;
        const newScale = Math.min(containerWidth / canvasWidth, this.config.maxScale);
        
        if (newScale !== this.state.scale) {
            this.state.scale = newScale;
            await this.renderPage(this.state.currentPage);
        }
    }

    /**
     * Set specific zoom level with enhanced error handling
     */
    private async setZoom(scale: number): Promise<void> {
        const newScale = Math.min(Math.max(scale, this.config.minScale), this.config.maxScale);
        if (newScale !== this.state.scale) {
            const previousScale = this.state.scale;
            try {
                this.state.scale = newScale;
                await this.renderPage(this.state.currentPage);
            } catch (error) {
                // Revert scale on error
                this.state.scale = previousScale;
                this.debugLog('Set zoom failed', { 
                    attemptedScale: newScale, 
                    revertedTo: previousScale,
                    error: (error as Error).message 
                });
                throw error;
            }
        }
    }

    /**
     * Fit page to container
     */
    private async fitToPage(): Promise<void> {
        const canvas = this.container?.querySelector('.pdf-canvas') as HTMLCanvasElement;
        const container = this.container?.querySelector('.pdf-viewer-content') as HTMLElement;
        
        if (!canvas || !container) return;

        const containerWidth = container.clientWidth - 32;
        const containerHeight = container.clientHeight - 32;
        const canvasWidth = canvas.width / this.state.scale;
        const canvasHeight = canvas.height / this.state.scale;
        
        const scaleX = containerWidth / canvasWidth;
        const scaleY = containerHeight / canvasHeight;
        const newScale = Math.min(scaleX, scaleY, this.config.maxScale);
        
        if (newScale !== this.state.scale) {
            this.state.scale = newScale;
            await this.renderPage(this.state.currentPage);
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
     * Update UI elements
     */
    private updateUI(): void {
        // Update page info
        const pageInfo = this.container?.querySelector('.pdf-page-info');
        if (pageInfo) {
            pageInfo.textContent = `Page ${this.state.currentPage} of ${this.state.totalPages}`;
        }

        // Update scale info
        const scaleInfo = this.container?.querySelector('.pdf-scale-info');
        if (scaleInfo) {
            scaleInfo.textContent = `${Math.round(this.state.scale * 100)}%`;
        }

        // Update page input
        const pageInput = this.container?.querySelector('.pdf-page-input') as HTMLInputElement;
        if (pageInput) {
            pageInput.value = this.state.currentPage.toString();
            pageInput.max = this.state.totalPages.toString();
        }

        // Update navigation buttons
        const firstBtn = this.container?.querySelector('.pdf-first-btn') as HTMLButtonElement;
        const prevBtn = this.container?.querySelector('.pdf-prev-btn') as HTMLButtonElement;
        const nextBtn = this.container?.querySelector('.pdf-next-btn') as HTMLButtonElement;
        const lastBtn = this.container?.querySelector('.pdf-last-btn') as HTMLButtonElement;
        
        if (firstBtn) {
            firstBtn.disabled = this.state.currentPage <= 1;
        }
        if (prevBtn) {
            prevBtn.disabled = this.state.currentPage <= 1;
        }
        if (nextBtn) {
            nextBtn.disabled = this.state.currentPage >= this.state.totalPages;
        }
        if (lastBtn) {
            lastBtn.disabled = this.state.currentPage >= this.state.totalPages;
        }

        // Update zoom buttons
        const zoomOutBtn = this.container?.querySelector('.pdf-zoom-out-btn') as HTMLButtonElement;
        const zoomInBtn = this.container?.querySelector('.pdf-zoom-in-btn') as HTMLButtonElement;
        
        if (zoomOutBtn) {
            zoomOutBtn.disabled = this.state.scale <= this.config.minScale;
        }
        if (zoomInBtn) {
            zoomInBtn.disabled = this.state.scale >= this.config.maxScale;
        }

        // Update zoom select dropdown
        this.updateZoomSelect();

        // Update fullscreen button
        const fullscreenBtn = this.container?.querySelector('.pdf-fullscreen-btn') as HTMLButtonElement;
        if (fullscreenBtn) {
            const icon = fullscreenBtn.querySelector('i');
            if (icon) {
                icon.className = this.state.isFullscreen ? 'fas fa-compress' : 'fas fa-expand';
            }
            fullscreenBtn.title = this.state.isFullscreen ? 'Exit fullscreen (Esc)' : 'Toggle fullscreen (Ctrl+F)';
        }

        // Add mobile CSS if needed
        this.addMobileStyles();
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

                .pdf-viewer-status {
                    font-size: 11px !important;
                    padding: 6px 12px !important;
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

            .pdf-fullscreen .pdf-viewer-status {
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
     * Cleanup resources
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

        // Clear state
        this.state.currentPage = 1;
        this.state.totalPages = 0;
        this.state.error = null;
        this.state.searchTerm = '';
        this.state.searchResults = [];
        this.state.currentSearchIndex = -1;
    }

    /**
     * Destroy instance
     */
    public destroy(): void {
        this.cleanup();
        this.eventListeners.clear();
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