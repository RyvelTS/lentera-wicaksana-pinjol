import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AiClient } from '../../services/ai-client';
import { MarkdownPipe } from '../../pipes/markdown.pipe';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  file?: {
    name: string;
    type: string;
    size?: number;
    url?: string;
  };
}

/**
 * MultimodalChat Component
 *
 * A chat component that supports multimodal interactions, allowing users to send text messages
 * along with file attachments (images, documents, etc.). The component manages conversation history,
 * file uploads with preview, and communicates with an AI service for processing multimodal requests.
 *
 */
@Component({
  selector: 'app-multimodal-chat',
  imports: [FormsModule, MarkdownPipe],
  templateUrl: './multimodal-chat.html',
  styleUrl: './multimodal-chat.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MultimodalChat {
  private aiClient = inject(AiClient);

  conversationHistory = signal<ChatMessage[]>([]);
  messageInput = signal('');
  isLoading = signal(false);
  errorMessage = signal('');
  selectedFile = signal<File | null>(null);
  selectedFilePreview = signal<string | null>(null);

  triggerFileInput() {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (input) input.click();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.size > 10 * 1024 * 1024) {
        this.errorMessage.set('❌ File terlalu besar (maks 10MB)');
        return;
      }
      this.selectedFile.set(file);
      this.errorMessage.set('');
      if (file.type.startsWith('image')) {
        const reader = new FileReader();
        reader.onload = (e) => this.selectedFilePreview.set(e.target?.result as string);
        reader.readAsDataURL(file);
      } else {
        this.selectedFilePreview.set(null);
      }
    }
  }

  clearFile() {
    this.selectedFile.set(null);
    this.selectedFilePreview.set(null);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (input) input.value = '';
  }

  sendMessage() {
    const message = this.messageInput().trim();
    if (!message && !this.selectedFile()) return;
    const fileData = this.selectedFile();
    const previewData = this.selectedFilePreview();

    const userMessage: ChatMessage = { role: 'user', content: message };
    if (fileData) {
      userMessage.file = {
        name: fileData.name,
        type: fileData.type,
        size: fileData.size,
        url: previewData || undefined,
      };
    }

    this.conversationHistory.update((hist) => [...hist, userMessage]);
    this.messageInput.set('');
    this.clearFile();
    this.isLoading.set(true);
    this.errorMessage.set('');

    const historyForApi = this.conversationHistory()
      .slice(0, -1)
      .map((msg) => ({ role: msg.role, content: msg.content }));

    this.aiClient.multimodalChat(message, fileData || undefined, historyForApi, 0.3).subscribe({
      next: (response) => {
        this.conversationHistory.update((hist) => [
          ...hist,
          { role: 'assistant', content: response.result },
        ]);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorMessage.set(error.message || 'Gagal mengirim pesan');
      },
    });
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}
