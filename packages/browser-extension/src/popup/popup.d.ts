interface ExtensionConfig {
    kindleEmail: string;
    workerUrl: string;
}
interface PageContent {
    title: string;
    content: string;
    url: string;
    author?: string;
}
declare class PopupManager {
    private kindleEmailInput;
    private workerUrlInput;
    private saveConfigBtn;
    private sendPageBtn;
    private pageTitleSpan;
    private pageUrlSpan;
    private statusMessage;
    init(): Promise<void>;
    private initializeElements;
    private attachEventListeners;
    private loadConfiguration;
    private saveConfiguration;
    private loadCurrentPageInfo;
    private sendCurrentPage;
    private sendToWorker;
    private getConfiguration;
    private updateSendButtonState;
    private showStatus;
    private isValidEmail;
    private isValidUrl;
}
//# sourceMappingURL=popup.d.ts.map